import { Router } from 'express';
import { env } from '../config/env.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { completeGoogleOAuth, createGoogleOAuthUrl, disconnectGoogleOAuth } from '../services/googleOAuthService.js';

export const integrationRoutes = Router();

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
