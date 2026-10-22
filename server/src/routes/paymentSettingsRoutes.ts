import { Router } from 'express';
import {
  bogConnectSchema,
  paymentActiveProviderSchema,
  paymentManualSettingsSchema,
  yookassaConnectSchema,
} from '../config/schemas.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import { canManageAccountSettings } from '../policies/rolePermissions.js';
import { trackServerError } from '../services/errorTrackingService.js';
import {
  MissingProviderSecretError,
  ProviderNotConnectedError,
  changeActiveProvider,
  connectKeyedProvider,
  disconnectProvider,
  getPaymentSettings,
  updateManualPaymentSettings,
} from '../services/paymentSettingsService.js';
import {
  NoPaymentMethodError,
  TestReminderDeliveryError,
  sendTestPaymentReminder,
} from '../services/paymentTestReminderService.js';
import { isPaymentProviderId } from '../services/payments/registry.js';
import { InvalidCredentialsError, ProviderUnreachableError } from '../services/payments/types.js';
import { formatZodError } from '../utils/validation.js';

export const paymentSettingsRoutes = Router();

const testReminderRateLimit = createRequestRateLimit({
  keyPrefix: 'payment-test-reminder',
  maxRequests: 5,
  windowMs: 10 * 60_000,
});

paymentSettingsRoutes.use(requireAccessToken, (req, res, next) => {
  const user = (req as unknown as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ code: 'forbidden', message: t(req, 'forbiddenAccountSettings') });
  }
  return next();
});

function invalidPayload(req: Parameters<typeof t>[0], error?: Parameters<typeof formatZodError>[0]) {
  return {
    ...(error ? formatZodError(error) : {}),
    code: 'invalid_payload',
    message: t(req, 'invalidPayloadPaymentSettings'),
  };
}

paymentSettingsRoutes.get('/', async (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  return res.json(await getPaymentSettings(user.accountId));
});

paymentSettingsRoutes.put('/manual', async (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  const parsed = paymentManualSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(invalidPayload(req, parsed.error));
  }
  return res.json(await updateManualPaymentSettings(user.accountId, parsed.data));
});

paymentSettingsRoutes.put('/providers/:provider', async (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  const { provider } = req.params;

  if (provider !== 'yookassa' && provider !== 'bog') {
    // Stripe connects through OAuth only (POST /api/integrations/stripe/oauth/start).
    return res.status(400).json(invalidPayload(req));
  }

  const fields = provider === 'yookassa'
    ? yookassaConnectSchema.safeParse(req.body)
    : bogConnectSchema.safeParse(req.body);
  if (!fields.success) {
    return res.status(400).json(invalidPayload(req, fields.error));
  }

  const data = fields.data as { shopId?: string; secretKey?: string; clientId?: string; clientSecret?: string };
  try {
    return res.json(await connectKeyedProvider(user.accountId, provider, {
      id: (provider === 'yookassa' ? data.shopId : data.clientId) ?? '',
      secret: (provider === 'yookassa' ? data.secretKey : data.clientSecret) || undefined,
    }));
  } catch (error) {
    if (error instanceof MissingProviderSecretError) {
      return res.status(400).json(invalidPayload(req));
    }
    if (error instanceof InvalidCredentialsError) {
      return res.status(422).json({ code: 'invalid_credentials', message: t(req, 'paymentCredentialsInvalid') });
    }
    if (error instanceof ProviderUnreachableError) {
      return res.status(502).json({ code: 'provider_unreachable', message: t(req, 'paymentProviderUnreachable') });
    }
    throw error;
  }
});

paymentSettingsRoutes.post('/providers/:provider/disconnect', async (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  const { provider } = req.params;
  if (!isPaymentProviderId(provider)) {
    return res.status(400).json(invalidPayload(req));
  }
  return res.json(await disconnectProvider(user.accountId, provider));
});

paymentSettingsRoutes.put('/active-provider', async (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  const parsed = paymentActiveProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(invalidPayload(req, parsed.error));
  }

  try {
    return res.json(await changeActiveProvider(user.accountId, parsed.data.provider));
  } catch (error) {
    if (error instanceof ProviderNotConnectedError) {
      return res.status(409).json({ code: 'provider_not_connected', message: t(req, 'paymentProviderNotConnected') });
    }
    throw error;
  }
});

paymentSettingsRoutes.post('/test-reminder', testReminderRateLimit, async (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  try {
    // The recipient is always the requesting user - never a client or a request-supplied address.
    return res.json(await sendTestPaymentReminder({ accountId: user.accountId, email: user.email }));
  } catch (error) {
    if (error instanceof NoPaymentMethodError) {
      return res.status(409).json({ code: 'no_payment_method', message: t(req, 'paymentNoMethod') });
    }
    if (error instanceof TestReminderDeliveryError) {
      return res.status(502).json({ code: 'delivery_failed', message: t(req, 'paymentTestReminderFailed') });
    }
    void trackServerError({ method: req.method, path: '/api/settings/payments/test-reminder', error });
    res.locals.errorTracked = true;
    return res.status(500).json({ message: t(req, 'paymentTestReminderFailed') });
  }
});
