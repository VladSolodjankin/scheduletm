import {
  findAccountPaymentProvider,
  findAccountPaymentProviderByWebhookTokenHash,
  type PaymentProviderId,
} from '../repositories/accountPaymentRepository.js';
import {
  beginProcessingPaymentWebhookEvent,
  findOrderByProviderOrderId,
  markProcessedPaymentWebhookEvent,
  releaseProcessingPaymentWebhookEvent,
  settleOrder,
} from '../repositories/paymentOrderRepository.js';
import { hashToken } from '../repositories/paymentTokenRepository.js';
import { toProviderCredentials } from './paymentSettingsService.js';
import { getPaymentAdapter } from './payments/registry.js';
import type { ProviderCredentials } from './payments/types.js';

export type PaymentWebhookOutcome =
  | { kind: 'unknown_account' }
  | { kind: 'ignored' }
  | { kind: 'order_not_found' }
  | { kind: 'duplicate_event' }
  | { kind: 'processed'; result: 'paid' | 'duplicate' | 'mismatch' | 'failed' | 'cancelled' | 'ignored' };

/**
 * Shared webhook pipeline. Throws InvalidSignatureError (-> 401) when authenticity fails; any other error
 * propagates (-> 5xx, the provider retries) after the event lease has been released.
 *
 * The order is resolved ONLY through our own payment_orders row; the account id comes from that row. For
 * token-addressed providers the row must additionally belong to the account resolved from the URL token.
 */
export async function processPaymentWebhook(input: {
  provider: PaymentProviderId;
  rawBody: Buffer;
  headers: Record<string, string | undefined>;
  accountToken?: string;
}): Promise<PaymentWebhookOutcome> {
  let credentials: ProviderCredentials | null = null;
  let tokenAccountId: number | null = null;

  if (input.provider === 'yookassa' || input.provider === 'bog') {
    if (!input.accountToken) {
      return { kind: 'unknown_account' };
    }
    const record = await findAccountPaymentProviderByWebhookTokenHash(input.provider, hashToken(input.accountToken));
    if (!record) {
      return { kind: 'unknown_account' };
    }
    tokenAccountId = record.account_id;
    credentials = toProviderCredentials(record);
  }

  const event = await getPaymentAdapter(input.provider).handleWebhook({
    rawBody: input.rawBody,
    headers: input.headers,
    credentials,
  });
  if (!event) {
    return { kind: 'ignored' };
  }

  const existingOrder = await findOrderByProviderOrderId(input.provider, event.orderRef);
  if (!existingOrder) {
    // Verified event for an order we have not stored yet (checkout still attaching the provider id): the route
    // answers non-2xx so the provider retries instead of dropping the payment.
    return { kind: 'order_not_found' };
  }
  if (tokenAccountId !== null && existingOrder.account_id !== tokenAccountId) {
    console.error('[payments] webhook-account-mismatch', { provider: input.provider, orderId: existingOrder.id });
    return { kind: 'ignored' };
  }
  if (input.provider === 'stripe') {
    const stripeRecord = await findAccountPaymentProvider(existingOrder.account_id, 'stripe');
    // A connected-account event must belong to the Stripe account this order was created on.
    if (!stripeRecord || !event.providerAccountId || stripeRecord.config_json?.accountId !== event.providerAccountId) {
      console.error('[payments] webhook-account-mismatch', { provider: 'stripe', orderId: existingOrder.id });
      return { kind: 'ignored' };
    }
  }

  const claim = await beginProcessingPaymentWebhookEvent(input.provider, event.eventId);
  if (claim.status !== 'acquired') {
    return { kind: 'duplicate_event' };
  }

  try {
    const settled = await settleOrder({
      provider: input.provider,
      providerOrderId: event.orderRef,
      outcome: event.status,
      amount: event.amount,
      currency: event.currency,
    });
    if (settled.result === 'mismatch') {
      console.error('[payments] amount-mismatch', { provider: input.provider, orderId: settled.order?.id });
    }
    await markProcessedPaymentWebhookEvent(input.provider, event.eventId, claim.processingToken);
    return { kind: 'processed', result: settled.result };
  } catch (error) {
    await releaseProcessingPaymentWebhookEvent(input.provider, event.eventId, claim.processingToken);
    throw error;
  }
}
