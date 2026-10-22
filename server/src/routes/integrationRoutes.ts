import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import { completeGoogleOAuth, createGoogleOAuthUrl, disconnectGoogleOAuth } from '../services/googleOAuthService.js';
import { createZoomMeeting } from '../services/zoomService.js';
import { completeZoomOAuth, createZoomOAuthUrl, disconnectZoomOAuth } from '../services/zoomOAuthService.js';
import {
  buildZoomUrlValidationResponse,
  isZoomWebhookConfigured,
  processZoomWebhookEvent,
  verifyZoomWebhookSignature,
  type ZoomWebhookPayload,
} from '../services/zoomWebhookService.js';
import { createYandexTelemostMeeting } from '../services/yandexService.js';
import { completeYandexOAuth, createYandexOAuthUrl, disconnectYandexOAuth } from '../services/yandexOAuthService.js';
import { formatZodError } from '../utils/validation.js';
import { trackServerError } from '../services/errorTrackingService.js';
import { completeStripeOAuth, createStripeOAuthUrl } from '../services/stripeOAuthService.js';
import { getMissingStripeEnv, isStripeWebhookConfigured } from '../services/payments/stripeAdapter.js';
import { InvalidSignatureError } from '../services/payments/types.js';
import { processPaymentWebhook } from '../services/paymentWebhookService.js';
import type { PaymentProviderId } from '../repositories/accountPaymentRepository.js';
import { canManageAccountSettings } from '../policies/rolePermissions.js';

export const integrationRoutes = Router();
const paymentWebhookRateLimit = createRequestRateLimit({ keyPrefix: 'payment-webhook', maxRequests: 300, windowMs: 60_000 });
const zoomWebhookRateLimit = createRequestRateLimit({ keyPrefix: 'zoom-webhook', maxRequests: 120, windowMs: 60_000 });

const zoomCreateMeetingSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  startTime: z.string().datetime(),
  duration: z.number().int().min(15).max(480),
  timezone: z.string().trim().min(1).max(100),
});

const yandexCreateMeetingSchema = zoomCreateMeetingSchema.partial();

integrationRoutes.post('/google/oauth/start', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const oauthInit = await createGoogleOAuthUrl(user.id, user.accountId);

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
  const ok = await disconnectGoogleOAuth(user.id, user.accountId);
  if (!ok) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  return res.json({
    provider: 'google',
    connected: false,
  });
});


integrationRoutes.post('/zoom/oauth/start', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const oauthInit = await createZoomOAuthUrl(user.id, user.accountId);

  if (!oauthInit) {
    return res.status(503).json({
      message: t(req, 'zoomOAuthNotConfigured'),
      requiredEnv: [
        'ZOOM_OAUTH_CLIENT_ID',
        'ZOOM_OAUTH_CLIENT_SECRET',
        'ZOOM_OAUTH_REDIRECT_URI'
      ]
    });
  }

  return res.json({
    provider: 'zoom',
    authorizeUrl: oauthInit.url,
    state: oauthInit.state
  });
});

integrationRoutes.get('/zoom/oauth/callback', async (req, res) => {
  const state = String(req.query.state ?? '');
  const code = String(req.query.code ?? '');

  if (!state || !code) {
    return res.redirect(`${env.APP_URL}/settings?zoom_oauth=error&reason=missing_code_or_state`);
  }

  const result = await completeZoomOAuth(state, code);

  if (!result.ok) {
    return res.redirect(`${env.APP_URL}/settings?zoom_oauth=error&reason=${result.reason}`);
  }

  return res.redirect(`${env.APP_URL}/settings?zoom_oauth=success`);
});

integrationRoutes.post('/zoom/disconnect', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const ok = await disconnectZoomOAuth(user.id, user.accountId);
  if (!ok) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  return res.json({
    provider: 'zoom',
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
    accountId: user.accountId,
    userId: user.id,
    topic: parsed.data.topic,
    startTime: parsed.data.startTime,
    duration: parsed.data.duration,
    timezone: parsed.data.timezone,
  });

  if (!result.ok) {
    if (result.reason === 'zoom_not_configured') {
      return res.status(503).json({
        message: t(req, 'zoomOAuthNotConfigured'),
        requiredEnv: ['ZOOM_OAUTH_CLIENT_ID', 'ZOOM_OAUTH_CLIENT_SECRET', 'ZOOM_OAUTH_REDIRECT_URI'],
      });
    }

    if (result.reason === 'zoom_not_connected' || result.reason === 'zoom_auth_failed') {
      return res.status(409).json({ message: t(req, 'zoomNotConnected') });
    }

    if (result.reason === 'invalid_user') {
      return res.status(400).json({ message: t(req, 'invalidUserId') });
    }

    return res.status(502).json({ message: t(req, 'zoomMeetingCreateFailed') });
  }

  return res.status(201).json(result.meeting);
});

integrationRoutes.post('/yandex/oauth/start', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const oauthInit = await createYandexOAuthUrl(user.id, user.accountId);

  if (!oauthInit) {
    return res.status(503).json({
      message: t(req, 'yandexOAuthNotConfigured'),
      requiredEnv: [
        'YANDEX_OAUTH_CLIENT_ID',
        'YANDEX_OAUTH_CLIENT_SECRET',
        'YANDEX_OAUTH_REDIRECT_URI'
      ]
    });
  }

  return res.json({
    provider: 'yandex_telemost',
    authorizeUrl: oauthInit.url,
    state: oauthInit.state
  });
});

integrationRoutes.get('/yandex/oauth/callback', async (req, res) => {
  const state = String(req.query.state ?? '');
  const code = String(req.query.code ?? '');

  if (!state || !code) {
    return res.redirect(`${env.APP_URL}/settings?yandex_oauth=error&reason=missing_code_or_state`);
  }

  const result = await completeYandexOAuth(state, code);

  if (!result.ok) {
    return res.redirect(`${env.APP_URL}/settings?yandex_oauth=error&reason=${result.reason}`);
  }

  return res.redirect(`${env.APP_URL}/settings?yandex_oauth=success`);
});

integrationRoutes.post('/yandex/disconnect', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const ok = await disconnectYandexOAuth(user.id, user.accountId);
  if (!ok) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  return res.json({
    provider: 'yandex_telemost',
    connected: false,
  });
});

integrationRoutes.post('/yandex/meetings', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  // Telemost conferences take no title/time; the body is accepted in Zoom's shape for client symmetry
  // but only validated, not forwarded.
  const parsed = yandexCreateMeetingSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  const result = await createYandexTelemostMeeting({
    accountId: user.accountId,
    userId: user.id,
  });

  if (!result.ok) {
    if (result.reason === 'yandex_not_configured') {
      return res.status(503).json({
        message: t(req, 'yandexOAuthNotConfigured'),
        requiredEnv: ['YANDEX_OAUTH_CLIENT_ID', 'YANDEX_OAUTH_CLIENT_SECRET', 'YANDEX_OAUTH_REDIRECT_URI'],
      });
    }

    if (result.reason === 'yandex_not_connected' || result.reason === 'yandex_auth_failed') {
      return res.status(409).json({ message: t(req, 'yandexNotConnected') });
    }

    if (result.reason === 'invalid_user') {
      return res.status(400).json({ message: t(req, 'invalidUserId') });
    }

    return res.status(502).json({ message: t(req, 'yandexMeetingCreateFailed') });
  }

  return res.status(201).json(result.meeting);
});

integrationRoutes.post('/zoom/webhook', zoomWebhookRateLimit, async (req, res) => {
  if (!isZoomWebhookConfigured()) {
    return res.status(404).end();
  }

  const body = req.body as ZoomWebhookPayload;

  // Zoom's one-time endpoint validation ping is not HMAC-signed like real events —
  // it proves ownership of the secret token via the response itself.
  if (body?.event === 'endpoint.url_validation') {
    const plainToken = (body as { payload?: { plainToken?: string } }).payload?.plainToken;
    if (typeof plainToken !== 'string' || !plainToken) {
      return res.status(400).end();
    }
    return res.status(200).json(buildZoomUrlValidationResponse(plainToken));
  }

  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  const isValid = rawBody && verifyZoomWebhookSignature({
    rawBody,
    timestampHeader: req.header('x-zm-request-timestamp'),
    signatureHeader: req.header('x-zm-signature'),
  });
  if (!isValid) {
    return res.status(401).end();
  }

  try {
    await processZoomWebhookEvent(body);
  } catch (error) {
    void trackServerError({ method: req.method, path: req.path, error });
  }

  return res.status(200).end();
});

// ---- Payments (Payment setup) ----

integrationRoutes.post('/stripe/oauth/start', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ code: 'forbidden', message: t(req, 'forbiddenAccountSettings') });
  }

  const oauthInit = await createStripeOAuthUrl(user.id, user.accountId);
  if (!oauthInit) {
    return res.status(503).json({
      message: t(req, 'stripeOAuthNotConfigured'),
      requiredEnv: getMissingStripeEnv(),
    });
  }

  return res.json({
    provider: 'stripe',
    authorizeUrl: oauthInit.url,
    state: oauthInit.state,
  });
});

integrationRoutes.get('/stripe/oauth/callback', async (req, res) => {
  const state = String(req.query.state ?? '');
  const code = String(req.query.code ?? '');
  const base = `${env.APP_URL}/settings/payments`;

  if (req.query.error) {
    // The user declined on Stripe's consent screen (or Stripe reported an error).
    return res.redirect(`${base}?stripe_oauth=error&reason=access_denied`);
  }
  if (!state || !code) {
    return res.redirect(`${base}?stripe_oauth=error&reason=missing_code_or_state`);
  }

  const result = await completeStripeOAuth(state, code);
  if (!result.ok) {
    return res.redirect(`${base}?stripe_oauth=error&reason=${result.reason}`);
  }

  return res.redirect(`${base}?stripe_oauth=success`);
});

async function respondToPaymentWebhook(
  provider: PaymentProviderId,
  req: import('express').Request,
  res: import('express').Response,
  accountToken?: string,
) {
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    return res.status(400).end();
  }

  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    headers[name.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }

  try {
    const outcome = await processPaymentWebhook({ provider, rawBody, headers, accountToken });
    if (outcome.kind === 'unknown_account') {
      return res.status(404).end();
    }
    if (outcome.kind === 'order_not_found') {
      return res.status(404).end();
    }
    return res.status(200).end();
  } catch (error) {
    if (error instanceof InvalidSignatureError) {
      return res.status(401).end();
    }
    // Never put the URL (it contains the account token) into the tracked path.
    void trackServerError({ method: req.method, path: `/api/integrations/${provider}/webhook`, error });
    res.locals.errorTracked = true;
    // 5xx makes the provider retry; the event lease was released by the pipeline.
    return res.status(500).end();
  }
}

integrationRoutes.post('/stripe/webhook', paymentWebhookRateLimit, async (req, res) => {
  if (!isStripeWebhookConfigured()) {
    return res.status(404).end();
  }
  return respondToPaymentWebhook('stripe', req, res);
});

integrationRoutes.post('/yookassa/webhook/:accountToken', paymentWebhookRateLimit, async (req, res) =>
  respondToPaymentWebhook('yookassa', req, res, String(req.params.accountToken)));

integrationRoutes.post('/bog/callback/:accountToken', paymentWebhookRateLimit, async (req, res) =>
  respondToPaymentWebhook('bog', req, res, String(req.params.accountToken)));
