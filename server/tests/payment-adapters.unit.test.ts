import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosGetMock = vi.hoisted(() => vi.fn());
const axiosPostMock = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({
  default: { get: axiosGetMock, post: axiosPostMock, isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean })?.isAxiosError) },
}));
vi.mock('../src/config/env.js', () => ({
  env: {
    STRIPE_CLIENT_ID: 'ca_test',
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_OAUTH_REDIRECT_URI: 'https://api.test/api/integrations/stripe/oauth/callback',
  },
}));

const { verifyBogCallbackSignature, bogAdapter } = await import('../src/services/payments/bogAdapter.js');
const { verifyStripeSignature, stripeAdapter } = await import('../src/services/payments/stripeAdapter.js');
const { yookassaAdapter } = await import('../src/services/payments/yookassaAdapter.js');
const { InvalidSignatureError, InvalidCredentialsError, ProviderUnreachableError } = await import('../src/services/payments/types.js');

const axiosError = (status: number) => Object.assign(new Error('http'), { isAxiosError: true, response: { status } });

describe('BOG adapter', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const body = Buffer.from(JSON.stringify({ event: 'order_payment', body: { order_id: 'o-1' } }));
  const sign = (raw: Buffer) => crypto.sign('RSA-SHA256', raw, privateKey).toString('base64');

  it('verifies SHA256withRSA over the raw bytes', () => {
    expect(verifyBogCallbackSignature(body, sign(body), pem)).toBe(true);
    expect(verifyBogCallbackSignature(Buffer.from(`${body.toString()} `), sign(body), pem)).toBe(false);
    expect(verifyBogCallbackSignature(body, undefined, pem)).toBe(false);
    expect(verifyBogCallbackSignature(body, 'not-base64!!', pem)).toBe(false);
  });

  it('rejects a callback signed with a foreign key (the bundled BOG key is used)', async () => {
    await expect(bogAdapter.handleWebhook({ rawBody: body, headers: { 'callback-signature': sign(body) }, credentials: null }))
      .rejects.toBeInstanceOf(InvalidSignatureError);
    await expect(bogAdapter.handleWebhook({ rawBody: body, headers: {}, credentials: null }))
      .rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it('supports GEL/USD/EUR/GBP only', () => {
    expect(['GEL', 'usd', 'EUR', 'GBP'].every((c) => bogAdapter.supportsCurrency(c))).toBe(true);
    expect(bogAdapter.supportsCurrency('RUB')).toBe(false);
  });

  it('maps a token rejection to invalid credentials', async () => {
    axiosPostMock.mockRejectedValueOnce(axiosError(401));
    await expect(bogAdapter.connect({ clientId: 'c', clientSecret: 's' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    axiosPostMock.mockRejectedValueOnce(axiosError(503));
    await expect(bogAdapter.connect({ clientId: 'c', clientSecret: 's' })).rejects.toBeInstanceOf(ProviderUnreachableError);
  });

  it('creates an order with callback_url, idempotency key and returns the redirect', async () => {
    axiosPostMock
      .mockResolvedValueOnce({ data: { access_token: 'jwt' } })
      .mockResolvedValueOnce({ data: { id: 'ord-1', _links: { redirect: { href: 'https://payment.bog.ge/?order_id=ord-1' } } } });
    const result = await bogAdapter.createPayment({
      credentials: { accountId: 1, config: { clientId: 'c' }, secret: 's' },
      orderId: 7, appointmentId: 9, amount: 120, currency: 'GEL', description: 'Consultation',
      returnUrls: { success: 'https://app.test/pay/t?status=success', fail: 'https://app.test/pay/t?status=fail' }, callbackUrl: 'https://api.test/cb/tok', idempotencyKey: 'uuid-1',
    });
    expect(result).toEqual({ providerOrderId: 'ord-1', redirectUrl: 'https://payment.bog.ge/?order_id=ord-1' });
    const [url, payload, options] = axiosPostMock.mock.calls[1];
    expect(url).toBe('https://api.bog.ge/payments/v1/ecommerce/orders');
    expect(payload).toMatchObject({
      callback_url: 'https://api.test/cb/tok',
      purchase_units: { total_amount: 120, currency: 'GEL' },
      redirect_urls: { success: 'https://app.test/pay/t?status=success', fail: 'https://app.test/pay/t?status=fail' },
    });
    expect(options.headers).toMatchObject({ Authorization: 'Bearer jwt', 'Idempotency-Key': 'uuid-1' });
  });
});

describe('Stripe adapter', () => {
  const secret = 'whsec_test';
  const event = (overrides: Record<string, unknown> = {}) => Buffer.from(JSON.stringify({
    id: 'evt_1', type: 'checkout.session.completed', account: 'acct_1',
    data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 150000, currency: 'usd' } },
    ...overrides,
  }));
  const header = (raw: Buffer, ts = Math.floor(Date.now() / 1000), key = secret) =>
    `t=${ts},v1=${crypto.createHmac('sha256', key).update(`${ts}.`).update(raw).digest('hex')}`;

  it('verifies the signature with a 5 minute tolerance', () => {
    const raw = event();
    const now = 1_800_000_000;
    expect(verifyStripeSignature(raw, header(raw, now), secret, now)).toBe(true);
    expect(verifyStripeSignature(raw, header(raw, now - 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(raw, header(raw, now, 'other'), secret, now)).toBe(false);
    expect(verifyStripeSignature(Buffer.from('{}'), header(raw, now), secret, now)).toBe(false);
    expect(verifyStripeSignature(raw, undefined, secret, now)).toBe(false);
  });

  it('normalizes a paid checkout.session.completed event', async () => {
    const raw = event();
    const result = await stripeAdapter.handleWebhook({ rawBody: raw, headers: { 'stripe-signature': header(raw) }, credentials: null });
    expect(result).toEqual({ eventId: 'evt_1', orderRef: 'cs_1', status: 'succeeded', amount: 1500, currency: 'USD', providerAccountId: 'acct_1' });
  });

  it('ignores unpaid sessions and unrelated events, rejects bad signatures', async () => {
    const unpaid = event({ data: { object: { id: 'cs_1', payment_status: 'unpaid' } } });
    expect(await stripeAdapter.handleWebhook({ rawBody: unpaid, headers: { 'stripe-signature': header(unpaid) }, credentials: null })).toBeNull();
    const other = event({ type: 'customer.created' });
    expect(await stripeAdapter.handleWebhook({ rawBody: other, headers: { 'stripe-signature': header(other) }, credentials: null })).toBeNull();
    await expect(stripeAdapter.handleWebhook({ rawBody: unpaid, headers: { 'stripe-signature': 't=1,v1=00' }, credentials: null }))
      .rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it('creates a direct-charge checkout session on the connected account', async () => {
    axiosPostMock.mockResolvedValueOnce({ data: { id: 'cs_9', url: 'https://checkout.stripe.com/c/pay/cs_9' } });
    const result = await stripeAdapter.createPayment({
      credentials: { accountId: 1, config: { accountId: 'acct_1' }, secret: null },
      orderId: 7, appointmentId: 9, amount: 15, currency: 'USD', description: 'Consultation',
      returnUrls: { success: 'https://app.test/pay/t?status=success', fail: 'https://app.test/pay/t?status=fail' }, callbackUrl: '', idempotencyKey: 'k',
    });
    expect(result.providerOrderId).toBe('cs_9');
    const [, body, options] = axiosPostMock.mock.calls[0];
    expect(options.headers['Stripe-Account']).toBe('acct_1');
    expect(new URLSearchParams(body).get('line_items[0][price_data][unit_amount]')).toBe('1500');
    expect(new URLSearchParams(body).get('success_url')).toBe('https://app.test/pay/t?status=success');
    expect(new URLSearchParams(body).get('cancel_url')).toBe('https://app.test/pay/t?status=fail');
    expect(body).not.toContain('application_fee');
  });
});

describe('YooKassa adapter', () => {
  beforeEach(() => { axiosGetMock.mockReset(); });
  const credentials = { accountId: 1, config: { shopId: '1001' }, secret: 'live_secret' };
  const notification = Buffer.from(JSON.stringify({ type: 'notification', event: 'payment.succeeded', object: { id: 'pay-1' } }));

  it('trusts only the payment fetched from the API, not the notification body', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { id: 'pay-1', status: 'succeeded', paid: true, amount: { value: '1500.00', currency: 'RUB' } } });
    const result = await yookassaAdapter.handleWebhook({ rawBody: notification, headers: {}, credentials });
    expect(result).toEqual({ eventId: 'succeeded:pay-1', orderRef: 'pay-1', status: 'succeeded', amount: 1500, currency: 'RUB' });
    expect(axiosGetMock.mock.calls[0][0]).toBe('https://api.yookassa.ru/v3/payments/pay-1');
    expect(axiosGetMock.mock.calls[0][1].auth).toEqual({ username: '1001', password: 'live_secret' });
  });

  it('returns null for a payment that is still pending and rejects forged ids (404)', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { id: 'pay-1', status: 'pending', paid: false } });
    expect(await yookassaAdapter.handleWebhook({ rawBody: notification, headers: {}, credentials })).toBeNull();
    axiosGetMock.mockRejectedValueOnce(axiosError(404));
    await expect(yookassaAdapter.handleWebhook({ rawBody: notification, headers: {}, credentials })).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  it('validates credentials against the shop and maps failures', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { account_id: '1001' } });
    await expect(yookassaAdapter.connect({ shopId: '1001', secretKey: 'k' })).resolves.toEqual({ config: { shopId: '1001' }, secret: 'k' });
    axiosGetMock.mockResolvedValueOnce({ data: { account_id: '2002' } });
    await expect(yookassaAdapter.connect({ shopId: '1001', secretKey: 'k' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    axiosGetMock.mockRejectedValueOnce(axiosError(401));
    await expect(yookassaAdapter.connect({ shopId: '1001', secretKey: 'k' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    axiosGetMock.mockRejectedValueOnce(axiosError(500));
    await expect(yookassaAdapter.connect({ shopId: '1001', secretKey: 'k' })).rejects.toBeInstanceOf(ProviderUnreachableError);
  });

  it('accepts RUB only', () => {
    expect(yookassaAdapter.supportsCurrency('RUB')).toBe(true);
    expect(yookassaAdapter.supportsCurrency('USD')).toBe(false);
  });
});
