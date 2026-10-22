import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import {
  InvalidCredentialsError,
  InvalidSignatureError,
  ProviderUnreachableError,
  type CreatePaymentInput,
  type PaymentAdapter,
  type WebhookInput,
  type WebhookResult,
} from './types.js';

const OAUTH_AUTHORIZE_URL = 'https://connect.stripe.com/oauth/authorize';
const OAUTH_TOKEN_URL = 'https://connect.stripe.com/oauth/token';
const OAUTH_DEAUTHORIZE_URL = 'https://connect.stripe.com/oauth/deauthorize';
const CHECKOUT_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

// Two-decimal currencies only (amounts are whole units; minor = x100). Zero-decimal currencies are excluded on purpose.
// Whether the connected account can actually charge in a currency is decided by Stripe at session creation.
const SUPPORTED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'GEL', 'PLN', 'CZK', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK',
]);

/** Names of the platform env vars Stripe still needs. A charge must never be possible while the webhook cannot mark it paid. */
export function getMissingStripeEnv(): string[] {
  return ([
    ['STRIPE_CLIENT_ID', env.STRIPE_CLIENT_ID],
    ['STRIPE_SECRET_KEY', env.STRIPE_SECRET_KEY],
    ['STRIPE_OAUTH_REDIRECT_URI', env.STRIPE_OAUTH_REDIRECT_URI],
    ['STRIPE_WEBHOOK_SECRET', env.STRIPE_WEBHOOK_SECRET],
  ] as const).filter(([, value]) => !value).map(([name]) => name);
}

export function isStripeConfigured(): boolean {
  return getMissingStripeEnv().length === 0;
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

export function buildStripeAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.STRIPE_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: env.STRIPE_OAUTH_REDIRECT_URI,
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function deauthorizeStripeAccount(stripeAccountId: string): Promise<void> {
  if (!env.STRIPE_CLIENT_ID || !env.STRIPE_SECRET_KEY) {
    return;
  }
  try {
    await axios.post(
      OAUTH_DEAUTHORIZE_URL,
      new URLSearchParams({ client_id: env.STRIPE_CLIENT_ID, stripe_user_id: stripeAccountId }).toString(),
      {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      },
    );
  } catch (error) {
    // Disconnect must still succeed locally; the account owner can revoke the app from the Stripe dashboard.
    console.error('[payments:stripe] deauthorize-failed', axios.isAxiosError(error) ? error.response?.status ?? error.code : 'unknown');
  }
}

/** Stripe-Signature: `t=<ts>,v1=<hex hmac of "<ts>.<raw body>">[,v1=...]`. */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) {
    return false;
  }
  const parts = header.split(',').map((part) => part.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean);
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) {
    return false;
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  return signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

type StripeEvent = {
  id?: string;
  type?: string;
  account?: string;
  data?: { object?: { id?: string; payment_status?: string; amount_total?: number; currency?: string } };
};

export const stripeAdapter: PaymentAdapter = {
  id: 'stripe',

  supportsCurrency: (currency) => SUPPORTED_CURRENCIES.has(currency.toUpperCase()),

  async connect(fields) {
    const code = fields.code?.trim();
    if (!code || !isStripeConfigured()) {
      throw new InvalidCredentialsError();
    }
    try {
      const response = await axios.post<{ stripe_user_id?: string }>(
        OAUTH_TOKEN_URL,
        new URLSearchParams({ grant_type: 'authorization_code', code }).toString(),
        {
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      if (!response.data.stripe_user_id) {
        throw new InvalidCredentialsError();
      }
      // Direct charges use the platform key + Stripe-Account header, so the connected account's token is not stored.
      return { config: { accountId: response.data.stripe_user_id }, secret: null };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw error;
      }
      if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
        throw new InvalidCredentialsError();
      }
      throw new ProviderUnreachableError();
    }
  },

  async createPayment(input: CreatePaymentInput) {
    const accountId = typeof input.credentials.config.accountId === 'string' ? input.credentials.config.accountId : '';
    if (!accountId || !isStripeConfigured()) {
      throw new InvalidCredentialsError();
    }

    const form = new URLSearchParams({
      mode: 'payment',
      success_url: input.returnUrls.success,
      cancel_url: input.returnUrls.fail,
      client_reference_id: String(input.orderId),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.amount * 100),
      'line_items[0][price_data][product_data][name]': input.description.slice(0, 250),
      'metadata[order_id]': String(input.orderId),
      'metadata[appointment_id]': String(input.appointmentId),
    });

    try {
      const response = await axios.post<{ id?: string; url?: string }>(CHECKOUT_SESSIONS_URL, form.toString(), {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Stripe-Account': accountId,
          'Idempotency-Key': input.idempotencyKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15_000,
      });
      if (!response.data.id || !response.data.url) {
        throw new ProviderUnreachableError();
      }
      return { providerOrderId: response.data.id, redirectUrl: response.data.url };
    } catch (error) {
      if (error instanceof ProviderUnreachableError) {
        throw error;
      }
      console.error('[payments:stripe] create-session-failed', axios.isAxiosError(error) ? error.response?.status ?? error.code : 'unknown');
      throw new ProviderUnreachableError();
    }
  },

  async handleWebhook(input: WebhookInput): Promise<WebhookResult | null> {
    if (!verifyStripeSignature(input.rawBody, input.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)) {
      throw new InvalidSignatureError();
    }

    let event: StripeEvent;
    try {
      event = JSON.parse(input.rawBody.toString('utf8'));
    } catch {
      throw new InvalidSignatureError();
    }

    const session = event.data?.object;
    if (!event.id || !session?.id || !event.type) {
      return null;
    }

    let status: WebhookResult['status'] | null = null;
    if (event.type === 'checkout.session.completed') {
      status = session.payment_status === 'paid' ? 'succeeded' : null;
    } else if (event.type === 'checkout.session.async_payment_succeeded') {
      status = 'succeeded';
    } else if (event.type === 'checkout.session.async_payment_failed') {
      status = 'failed';
    } else if (event.type === 'checkout.session.expired') {
      status = 'cancelled';
    }
    if (!status) {
      return null;
    }

    return {
      eventId: event.id,
      orderRef: session.id,
      status,
      amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
      currency: session.currency ? session.currency.toUpperCase() : null,
      providerAccountId: event.account,
    };
  },
};
