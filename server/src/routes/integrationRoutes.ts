import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { completeGoogleOAuth, createGoogleOAuthUrl, disconnectGoogleOAuth } from '../services/googleOAuthService.js';
import { createZoomMeeting } from '../services/zoomService.js';
import { formatZodError } from '../utils/validation.js';

export const integrationRoutes = Router();

const zoomCreateMeetingSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  startTime: z.string().datetime(),
  duration: z.number().int().min(15).max(480),
  timezone: z.string().trim().min(1).max(100),
});

integrationRoutes.post('/google/oauth/start', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const oauthInit = await createGoogleOAuthUrl(user.id);

  if (!oauthInit) {
    return res.status(503).json({
      message: t(req, 'googleOAuthNotConfigured'),
      requiredEnv: [
        'GOOGLE_OAUTH_CLIENT_ID',
        'GOOGLE_OAUTH_CLIENT_SECRET',
        'GOOGLE_OAUTH_REDIRECT_URI'
      ]
    });
  }

  return res.json({
    provider: 'google',
    authorizeUrl: oauthInit.url,
    state: oauthInit.state
  });
});

integrationRoutes.get('/google/oauth/callback', async (req, res) => {
  const state = String(req.query.state ?? '');
  const code = String(req.query.code ?? '');

  if (!state || !code) {
    return res.redirect(`${env.APP_URL}/settings?google_oauth=error&reason=missing_code_or_state`);
  }

  const result = await completeGoogleOAuth(state, code);

  if (!result.ok) {
    return res.redirect(`${env.APP_URL}/settings?google_oauth=error&reason=${result.reason}`);
  }

  return res.redirect(`${env.APP_URL}/settings?google_oauth=success`);
});

integrationRoutes.post('/google/disconnect', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const ok = await disconnectGoogleOAuth(user.id);
  if (!ok) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  return res.json({
    provider: 'google',
    connected: false,
  });
});

integrationRoutes.post('/zoom/meetings', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const parsed = zoomCreateMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  const result = await createZoomMeeting({
    userId: user.id,
    topic: parsed.data.topic,
    startTime: parsed.data.startTime,
    duration: parsed.data.duration,
    timezone: parsed.data.timezone,
  });

  if (!result.ok) {
    if (result.reason === 'zoom_not_configured') {
      return res.status(503).json({
        message: t(req, 'zoomNotConfigured'),
        requiredEnv: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
      });
    }

    if (result.reason === 'invalid_user') {
      return res.status(400).json({ message: t(req, 'invalidUserId') });
    }

    return res.status(502).json({ message: t(req, 'zoomMeetingCreateFailed') });
  }

  return res.status(201).json(result.meeting);
});
