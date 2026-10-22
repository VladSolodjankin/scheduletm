import { PAYMENT_PROVIDER_IDS, type PaymentProviderId } from '../../repositories/accountPaymentRepository.js';
import { bogAdapter } from './bogAdapter.js';
import { stripeAdapter } from './stripeAdapter.js';
import type { PaymentAdapter } from './types.js';
import { yookassaAdapter } from './yookassaAdapter.js';

const adapters: Record<PaymentProviderId, PaymentAdapter> = {
  stripe: stripeAdapter,
  yookassa: yookassaAdapter,
  bog: bogAdapter,
};

export function getPaymentAdapter(provider: PaymentProviderId): PaymentAdapter {
  return adapters[provider];
}

export function isPaymentProviderId(value: unknown): value is PaymentProviderId {
  return typeof value === 'string' && (PAYMENT_PROVIDER_IDS as readonly string[]).includes(value);
}
