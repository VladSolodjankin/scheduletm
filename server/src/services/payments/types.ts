import type { PaymentProviderId } from '../../repositories/accountPaymentRepository.js';

export type { PaymentProviderId };

export class InvalidCredentialsError extends Error {
  constructor() {
    super('INVALID_CREDENTIALS');
  }
}

export class ProviderUnreachableError extends Error {
  constructor() {
    super('PROVIDER_UNREACHABLE');
  }
}

export class InvalidSignatureError extends Error {
  constructor() {
    super('INVALID_SIGNATURE');
  }
}

/** Decrypted per-account provider credentials. `config` is non-secret (shopId / clientId / Stripe account id). */
export type ProviderCredentials = {
  accountId: number;
  config: Record<string, unknown>;
  secret: string | null;
};

export type CreatePaymentInput = {
  credentials: ProviderCredentials;
  orderId: number;
  appointmentId: number;
  /** Whole currency units, same convention as services.price. */
  amount: number;
  currency: string;
  description: string;
  /** Where the provider sends the customer back; `status` is cosmetic only (never trusted for state). */
  returnUrls: { success: string; fail: string };
  /** Public HTTPS URL the provider calls back (YooKassa/BOG; contains the account token). */
  callbackUrl: string;
  idempotencyKey: string;
};

export type CreatePaymentResult = { providerOrderId: string; redirectUrl: string };

export type WebhookResult = {
  /** Idempotency key of the (verified) event. */
  eventId: string;
  /** The provider-side order id; resolved ONLY against our own payment_orders rows. */
  orderRef: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  /** Whole units; null when the provider did not report an amount. */
  amount: number | null;
  currency: string | null;
  /** Stripe only: connected account the event belongs to. */
  providerAccountId?: string;
};

export type WebhookInput = {
  rawBody: Buffer;
  headers: Record<string, string | undefined>;
  /** Credentials of the account resolved from the URL token (YooKassa/BOG); null for Stripe. */
  credentials: ProviderCredentials | null;
};

export interface PaymentAdapter {
  readonly id: PaymentProviderId;
  supportsCurrency(currency: string): boolean;
  /** Validates/exchanges account credentials and returns what must be stored. */
  connect(fields: Record<string, string>): Promise<{ config: Record<string, unknown>; secret: string | null }>;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /**
   * Verifies the notification (signature or provider re-fetch) and normalizes it.
   * Throws InvalidSignatureError when authenticity cannot be established; returns null for irrelevant events.
   */
  handleWebhook(input: WebhookInput): Promise<WebhookResult | null>;
}
