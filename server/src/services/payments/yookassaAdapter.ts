import axios from 'axios';
import {
  InvalidCredentialsError,
  InvalidSignatureError,
  ProviderUnreachableError,
  type CreatePaymentInput,
  type PaymentAdapter,
  type ProviderCredentials,
  type WebhookInput,
  type WebhookResult,
} from './types.js';

const API_BASE = 'https://api.yookassa.ru/v3';
const SUPPORTED_CURRENCIES = new Set(['RUB']);

type YooKassaPayment = {
  id: string;
  status: string;
  paid?: boolean;
  amount?: { value: string; currency: string };
  confirmation?: { confirmation_url?: string };
};

function basicAuth(shopId: string, secret: string) {
  return { username: shopId, password: secret };
}

function credentialsOf(credentials: ProviderCredentials): { shopId: string; secret: string } {
  const shopId = typeof credentials.config.shopId === 'string' ? credentials.config.shopId : '';
  if (!shopId || !credentials.secret) {
    throw new InvalidCredentialsError();
  }
  return { shopId, secret: credentials.secret };
}

function mapError(error: unknown): never {
  if (axios.isAxiosError(error) && error.response && (error.response.status === 401 || error.response.status === 403)) {
    throw new InvalidCredentialsError();
  }
  console.error('[payments:yookassa] request-failed', axios.isAxiosError(error) ? error.response?.status ?? error.code : 'unknown');
  throw new ProviderUnreachableError();
}

function toWholeUnits(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const yookassaAdapter: PaymentAdapter = {
  id: 'yookassa',

  supportsCurrency: (currency) => SUPPORTED_CURRENCIES.has(currency.toUpperCase()),

  async connect(fields) {
    const shopId = fields.shopId?.trim();
    const secret = fields.secretKey?.trim();
    if (!shopId || !secret) {
      throw new InvalidCredentialsError();
    }

    try {
      // Cheap authenticated GET: returns the shop the key belongs to.
      const response = await axios.get<{ account_id?: string | number }>(`${API_BASE}/me`, {
        auth: basicAuth(shopId, secret),
        timeout: 10_000,
      });
      const reported = response.data?.account_id;
      if (reported !== undefined && String(reported) !== shopId) {
        throw new InvalidCredentialsError();
      }
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw error;
      }
      mapError(error);
    }

    return { config: { shopId }, secret };
  },

  async createPayment(input: CreatePaymentInput) {
    const { shopId, secret } = credentialsOf(input.credentials);
    try {
      const response = await axios.post<YooKassaPayment>(
        `${API_BASE}/payments`,
        {
          amount: { value: `${input.amount}.00`, currency: input.currency.toUpperCase() },
          capture: true,
          confirmation: { type: 'redirect', return_url: input.returnUrls.success },
          description: input.description.slice(0, 128),
          metadata: { order_id: String(input.orderId), appointment_id: String(input.appointmentId) },
        },
        {
          auth: basicAuth(shopId, secret),
          headers: { 'Idempotence-Key': input.idempotencyKey },
          timeout: 15_000,
        },
      );
      const redirectUrl = response.data.confirmation?.confirmation_url;
      if (!response.data.id || !redirectUrl) {
        throw new ProviderUnreachableError();
      }
      return { providerOrderId: response.data.id, redirectUrl };
    } catch (error) {
      if (error instanceof ProviderUnreachableError) {
        throw error;
      }
      mapError(error);
    }
  },

  /**
   * YooKassa notifications are NOT signed. The body is only a trigger: we fetch the payment from the API with the
   * account's own credentials and trust nothing but that response.
   */
  async handleWebhook(input: WebhookInput): Promise<WebhookResult | null> {
    if (!input.credentials) {
      throw new InvalidSignatureError();
    }
    let payload: { type?: string; event?: string; object?: { id?: string } };
    try {
      payload = JSON.parse(input.rawBody.toString('utf8'));
    } catch {
      throw new InvalidSignatureError();
    }
    const paymentId = payload.object?.id;
    if (payload.type !== 'notification' || typeof paymentId !== 'string' || !paymentId) {
      return null;
    }

    const { shopId, secret } = credentialsOf(input.credentials);
    let payment: YooKassaPayment;
    try {
      payment = (await axios.get<YooKassaPayment>(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
        auth: basicAuth(shopId, secret),
        timeout: 10_000,
      })).data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Not a payment of this shop: treat the notification as unauthenticated.
        throw new InvalidSignatureError();
      }
      mapError(error);
    }

    if (payment.id !== paymentId) {
      throw new InvalidSignatureError();
    }

    const status = payment.status === 'succeeded' && payment.paid !== false
      ? 'succeeded'
      : payment.status === 'canceled' ? 'cancelled' : null;
    if (!status) {
      return null;
    }

    return {
      eventId: `${status}:${payment.id}`,
      orderRef: payment.id,
      status,
      amount: toWholeUnits(payment.amount?.value),
      currency: payment.amount?.currency ?? null,
    };
  },
};
