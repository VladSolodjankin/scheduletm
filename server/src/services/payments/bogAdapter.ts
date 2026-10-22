import axios from 'axios';
import crypto from 'node:crypto';
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

const TOKEN_URL = 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const ORDERS_URL = 'https://api.bog.ge/payments/v1/ecommerce/orders';
const SUPPORTED_CURRENCIES = new Set(['GEL', 'USD', 'EUR', 'GBP']);

/** Public key published by Bank of Georgia for verifying `Callback-Signature` (api.bog.ge/docs/en/payments/standard-process/callback). */
export const BOG_CALLBACK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`;

/** SHA256withRSA over the RAW body. The signature header is base64 (per BOG docs: "encrypting body with a private key"). */
export function verifyBogCallbackSignature(rawBody: Buffer, signatureHeader: string | undefined, publicKey = BOG_CALLBACK_PUBLIC_KEY): boolean {
  if (!signatureHeader) {
    return false;
  }
  try {
    return crypto.verify('RSA-SHA256', rawBody, publicKey, Buffer.from(signatureHeader.trim(), 'base64'));
  } catch {
    return false;
  }
}

async function requestAccessToken(clientId: string, clientSecret: string): Promise<string> {
  try {
    const response = await axios.post<{ access_token?: string }>(
      TOKEN_URL,
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      },
    );
    if (!response.data.access_token) {
      throw new InvalidCredentialsError();
    }
    return response.data.access_token;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      throw error;
    }
    if (axios.isAxiosError(error) && error.response && [400, 401, 403].includes(error.response.status)) {
      throw new InvalidCredentialsError();
    }
    console.error('[payments:bog] token-request-failed', axios.isAxiosError(error) ? error.response?.status ?? error.code : 'unknown');
    throw new ProviderUnreachableError();
  }
}

function credentialsOf(credentials: ProviderCredentials): { clientId: string; secret: string } {
  const clientId = typeof credentials.config.clientId === 'string' ? credentials.config.clientId : '';
  if (!clientId || !credentials.secret) {
    throw new InvalidCredentialsError();
  }
  return { clientId, secret: credentials.secret };
}

type BogCallbackPayload = {
  event?: string;
  zoned_request_time?: string;
  body?: {
    order_id?: string;
    order_status?: { key?: string };
    purchase_units?: { request_amount?: string; transfer_amount?: string; currency_code?: string };
  };
};

export const bogAdapter: PaymentAdapter = {
  id: 'bog',

  supportsCurrency: (currency) => SUPPORTED_CURRENCIES.has(currency.toUpperCase()),

  async connect(fields) {
    const clientId = fields.clientId?.trim();
    const secret = fields.clientSecret?.trim();
    if (!clientId || !secret) {
      throw new InvalidCredentialsError();
    }
    await requestAccessToken(clientId, secret);
    return { config: { clientId }, secret };
  },

  async createPayment(input: CreatePaymentInput) {
    const { clientId, secret } = credentialsOf(input.credentials);
    const token = await requestAccessToken(clientId, secret);
    try {
      const response = await axios.post<{ id?: string; _links?: { redirect?: { href?: string } } }>(
        ORDERS_URL,
        {
          callback_url: input.callbackUrl,
          external_order_id: String(input.orderId),
          purchase_units: {
            currency: input.currency.toUpperCase(),
            total_amount: input.amount,
            basket: [{
              product_id: String(input.appointmentId),
              description: input.description.slice(0, 200),
              quantity: 1,
              unit_price: input.amount,
            }],
          },
          redirect_urls: { success: input.returnUrls.success, fail: input.returnUrls.fail },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': input.idempotencyKey,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        },
      );
      const redirectUrl = response.data._links?.redirect?.href;
      if (!response.data.id || !redirectUrl) {
        throw new ProviderUnreachableError();
      }
      return { providerOrderId: response.data.id, redirectUrl };
    } catch (error) {
      if (error instanceof ProviderUnreachableError) {
        throw error;
      }
      console.error('[payments:bog] create-order-failed', axios.isAxiosError(error) ? error.response?.status ?? error.code : 'unknown');
      throw new ProviderUnreachableError();
    }
  },

  async handleWebhook(input: WebhookInput): Promise<WebhookResult | null> {
    // Signature is verified over the raw bytes BEFORE any JSON parsing.
    if (!verifyBogCallbackSignature(input.rawBody, input.headers['callback-signature'])) {
      throw new InvalidSignatureError();
    }

    let payload: BogCallbackPayload;
    try {
      payload = JSON.parse(input.rawBody.toString('utf8'));
    } catch {
      throw new InvalidSignatureError();
    }

    const body = payload.body;
    const orderId = body?.order_id;
    const statusKey = body?.order_status?.key;
    if (payload.event !== 'order_payment' || !orderId || !statusKey) {
      return null;
    }

    const status = statusKey === 'completed' ? 'succeeded' : statusKey === 'rejected' ? 'failed' : null;
    if (!status) {
      return null;
    }

    // request_amount = what we asked for, transfer_amount = what was actually processed (can differ, e.g. discounts).
    // They must agree; on any difference report the processed amount so the order is flagged as a mismatch.
    const units = body.purchase_units;
    const requested = units?.request_amount === undefined ? null : Number(units.request_amount);
    const transferred = units?.transfer_amount === undefined ? null : Number(units.transfer_amount);
    const rawAmount = requested !== null && (transferred === null || transferred === requested) ? requested : transferred;
    const amount = rawAmount;
    return {
      eventId: `${orderId}:${statusKey}`,
      orderRef: orderId,
      status,
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      currency: body.purchase_units?.currency_code ?? null,
    };
  },
};
