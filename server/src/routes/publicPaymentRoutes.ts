import { Router } from 'express';
import { t } from '../i18n/index.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import {
  PaymentLinkGoneError,
  PaymentLinkNotFoundError,
  PaymentUnavailableError,
  createPublicCheckout,
  getPublicPaymentView,
} from '../services/paymentCheckoutService.js';
import { trackServerError } from '../services/errorTrackingService.js';
import { ProviderUnreachableError } from '../services/payments/types.js';

export const publicPaymentRoutes = Router();

// Unauthenticated, token-gated: limited per client IP.
const viewRateLimit = createRequestRateLimit({ keyPrefix: 'public-payment-view', maxRequests: 60, windowMs: 60_000 });
const checkoutRateLimit = createRequestRateLimit({ keyPrefix: 'public-payment-checkout', maxRequests: 20, windowMs: 60_000 });

publicPaymentRoutes.get('/:token', viewRateLimit, async (req, res) => {
  try {
    return res.json(await getPublicPaymentView(String(req.params.token)));
  } catch (error) {
    if (error instanceof PaymentLinkNotFoundError) {
      return res.status(404).json({ code: 'not_found', message: t(req, 'paymentLinkNotFound') });
    }
    if (error instanceof PaymentLinkGoneError) {
      return res.status(410).json({ code: 'gone', message: t(req, 'paymentLinkGone') });
    }
    throw error;
  }
});

publicPaymentRoutes.post('/:token/checkout', checkoutRateLimit, async (req, res) => {
  try {
    return res.json(await createPublicCheckout(String(req.params.token)));
  } catch (error) {
    if (error instanceof PaymentLinkNotFoundError) {
      return res.status(404).json({ code: 'not_found', message: t(req, 'paymentLinkNotFound') });
    }
    if (error instanceof PaymentLinkGoneError) {
      return res.status(410).json({ code: 'gone', message: t(req, 'paymentLinkGone') });
    }
    if (error instanceof PaymentUnavailableError) {
      return res.status(409).json({ code: 'payment_unavailable', message: t(req, 'paymentUnavailable') });
    }
    if (error instanceof ProviderUnreachableError) {
      return res.status(502).json({ code: 'provider_unreachable', message: t(req, 'paymentProviderUnreachable') });
    }
    void trackServerError({ method: req.method, path: '/api/public/payments/:token/checkout', error });
    res.locals.errorTracked = true;
    return res.status(500).json({ code: 'internal_error' });
  }
});
