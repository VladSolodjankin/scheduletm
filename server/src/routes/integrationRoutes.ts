import { Router } from 'express';
import { env } from '../config/env.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { completeGoogleOAuth, createGoogleOAuthUrl } from '../services/googleOAuthService.js';

export const integrationRoutes = Router();

integrationRoutes.post('/google/oauth/start', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const oauthInit = await createGoogleOAuthUrl(user.id);

  if (!oauthInit) {
    return res.status(503).json({
      message: 'Google OAuth is not configured on server',
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
