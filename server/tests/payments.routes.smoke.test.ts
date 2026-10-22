import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { WebUserRole } from '../src/types/webUserRole.js';

process.env.STRIPE_SECRET_KEY = 'sk_route_test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_route_test';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getPaymentSettingsMock = vi.hoisted(() => vi.fn());
const updateManualMock = vi.hoisted(() => vi.fn());
const connectKeyedProviderMock = vi.hoisted(() => vi.fn());
const disconnectProviderMock = vi.hoisted(() => vi.fn());
const changeActiveProviderMock = vi.hoisted(() => vi.fn());
const sendTestReminderMock = vi.hoisted(() => vi.fn());
const viewMock = vi.hoisted(() => vi.fn());
const checkoutMock = vi.hoisted(() => vi.fn());
const processWebhookMock = vi.hoisted(() => vi.fn());
const markUnpaidMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({ resolveUserByAccessToken: resolveUserByAccessTokenMock }));
vi.mock('../src/services/paymentSettingsService.js', async (original) => ({
  ...await original<typeof import('../src/services/paymentSettingsService.js')>(),
  getPaymentSettings: getPaymentSettingsMock,
  updateManualPaymentSettings: updateManualMock,
  connectKeyedProvider: connectKeyedProviderMock,
  disconnectProvider: disconnectProviderMock,
  changeActiveProvider: changeActiveProviderMock,
}));
vi.mock('../src/services/paymentTestReminderService.js', async (original) => ({
  ...await original<typeof import('../src/services/paymentTestReminderService.js')>(),
  sendTestPaymentReminder: sendTestReminderMock,
}));
vi.mock('../src/services/paymentCheckoutService.js', async (original) => ({
  ...await original<typeof import('../src/services/paymentCheckoutService.js')>(),
  getPublicPaymentView: viewMock,
  createPublicCheckout: checkoutMock,
}));
vi.mock('../src/services/paymentWebhookService.js', () => ({ processPaymentWebhook: processWebhookMock }));
vi.mock('../src/services/appointmentService.js', async (original) => ({
  ...await original<typeof import('../src/services/appointmentService.js')>(),
  markUnpaidAppointmentForActor: markUnpaidMock,
}));

const { createApp } = await import('../src/app.js');
const { ProviderNotConnectedError, MissingProviderSecretError } = await import('../src/services/paymentSettingsService.js');
const { NoPaymentMethodError, TestReminderDeliveryError } = await import('../src/services/paymentTestReminderService.js');
const { PaymentLinkGoneError, PaymentLinkNotFoundError, PaymentUnavailableError } = await import('../src/services/paymentCheckoutService.js');
const { InvalidCredentialsError, InvalidSignatureError, ProviderUnreachableError } = await import('../src/services/payments/types.js');

const owner = { id: '5', accountId: 2, email: 'owner@test.dev', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const headers = { authorization: 'Bearer token', 'content-type': 'application/json' };
const settingsShape = { activeProvider: null, hasAnyMethod: false };
const manualBody = {
  bankTransfer: { enabled: true, text: 'IBAN 1' },
  customLink: { enabled: false, title: '', url: '' },
  cash: { enabled: false, comment: '' },
};

describe('payment routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const call = (method: string, path: string, body?: unknown, extra: Record<string, string> = headers) =>
    fetch(`${baseUrl}${path}`, { method, headers: extra, body: body === undefined ? undefined : JSON.stringify(body) });

  beforeAll(async () => {
    server = await new Promise((resolve) => { const started = app.listen(0, () => resolve(started)); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserByAccessTokenMock.mockResolvedValue(owner);
    getPaymentSettingsMock.mockResolvedValue(settingsShape);
    updateManualMock.mockResolvedValue(settingsShape);
    connectKeyedProviderMock.mockResolvedValue(settingsShape);
    disconnectProviderMock.mockResolvedValue(settingsShape);
    changeActiveProviderMock.mockResolvedValue(settingsShape);
    sendTestReminderMock.mockResolvedValue({ sentTo: 'owner@test.dev' });
  });

  describe('settings', () => {
    it('requires authentication and the account-settings permission', async () => {
      expect((await call('GET', '/api/settings/payments', undefined, {})).status).toBe(401);
      for (const role of [WebUserRole.Specialist, WebUserRole.Client]) {
        resolveUserByAccessTokenMock.mockResolvedValue({ ...owner, role });
        expect((await call('GET', '/api/settings/payments')).status).toBe(403);
        expect((await call('PUT', '/api/settings/payments/manual', manualBody)).status).toBe(403);
        expect((await call('POST', '/api/settings/payments/test-reminder')).status).toBe(403);
      }
      expect(updateManualMock).not.toHaveBeenCalled();
    });

    it('scopes reads and writes to the user account', async () => {
      expect((await call('GET', '/api/settings/payments')).status).toBe(200);
      expect(getPaymentSettingsMock).toHaveBeenCalledWith(2);
      expect((await call('PUT', '/api/settings/payments/manual', manualBody)).status).toBe(200);
      expect(updateManualMock).toHaveBeenCalledWith(2, manualBody);
    });

    it('validates manual settings (enabled needs details, https only, length limits)', async () => {
      const bad = [
        { ...manualBody, bankTransfer: { enabled: true, text: '' } },
        { ...manualBody, customLink: { enabled: true, title: '', url: 'https://x.test' } },
        { ...manualBody, customLink: { enabled: true, title: 'Pay', url: 'http://x.test' } },
        { ...manualBody, customLink: { enabled: false, title: 'Pay', url: 'javascript:alert(1)' } },
        { ...manualBody, bankTransfer: { enabled: true, text: 'x'.repeat(1001) } },
        { ...manualBody, customLink: { enabled: true, title: 'x'.repeat(61), url: 'https://x.test' } },
        { ...manualBody, cash: { enabled: true, comment: 'x'.repeat(501) } },
      ];
      for (const body of bad) {
        const response = await call('PUT', '/api/settings/payments/manual', body);
        expect(response.status).toBe(400);
        expect((await response.json()).code).toBe('invalid_payload');
      }
      expect(updateManualMock).not.toHaveBeenCalled();
    });

    it('connects keyed providers and maps provider failures', async () => {
      expect((await call('PUT', '/api/settings/payments/providers/yookassa', { shopId: '1001', secretKey: 'k' })).status).toBe(200);
      expect(connectKeyedProviderMock).toHaveBeenCalledWith(2, 'yookassa', { id: '1001', secret: 'k' });
      expect((await call('PUT', '/api/settings/payments/providers/bog', { clientId: 'c' })).status).toBe(200);
      expect(connectKeyedProviderMock).toHaveBeenLastCalledWith(2, 'bog', { id: 'c', secret: undefined });

      connectKeyedProviderMock.mockRejectedValueOnce(new InvalidCredentialsError());
      const invalid = await call('PUT', '/api/settings/payments/providers/yookassa', { shopId: '1', secretKey: 'k' });
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).code).toBe('invalid_credentials');

      connectKeyedProviderMock.mockRejectedValueOnce(new ProviderUnreachableError());
      const unreachable = await call('PUT', '/api/settings/payments/providers/bog', { clientId: 'c', clientSecret: 's' });
      expect(unreachable.status).toBe(502);
      expect((await unreachable.json()).code).toBe('provider_unreachable');

      connectKeyedProviderMock.mockRejectedValueOnce(new MissingProviderSecretError());
      expect((await call('PUT', '/api/settings/payments/providers/bog', { clientId: 'c' })).status).toBe(400);
      expect((await call('PUT', '/api/settings/payments/providers/stripe', { x: 1 })).status).toBe(400);
      expect((await call('PUT', '/api/settings/payments/providers/yookassa', {})).status).toBe(400);
    });

    it('disconnects and switches the active provider', async () => {
      expect((await call('POST', '/api/settings/payments/providers/stripe/disconnect')).status).toBe(200);
      expect(disconnectProviderMock).toHaveBeenCalledWith(2, 'stripe');
      expect((await call('POST', '/api/settings/payments/providers/nope/disconnect')).status).toBe(400);

      expect((await call('PUT', '/api/settings/payments/active-provider', { provider: 'bog' })).status).toBe(200);
      expect((await call('PUT', '/api/settings/payments/active-provider', { provider: null })).status).toBe(200);
      expect((await call('PUT', '/api/settings/payments/active-provider', { provider: 'paypal' })).status).toBe(400);
      changeActiveProviderMock.mockRejectedValueOnce(new ProviderNotConnectedError());
      const conflict = await call('PUT', '/api/settings/payments/active-provider', { provider: 'stripe' });
      expect(conflict.status).toBe(409);
      expect((await conflict.json()).code).toBe('provider_not_connected');
    });

    it('sends the test reminder to the requesting user only', async () => {
      const response = await call('POST', '/api/settings/payments/test-reminder', { to: 'victim@example.com' });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sentTo: 'owner@test.dev' });
      expect(sendTestReminderMock).toHaveBeenCalledWith({ accountId: 2, email: 'owner@test.dev' });

      sendTestReminderMock.mockRejectedValueOnce(new NoPaymentMethodError());
      const none = await call('POST', '/api/settings/payments/test-reminder');
      expect(none.status).toBe(409);
      expect((await none.json()).code).toBe('no_payment_method');

      sendTestReminderMock.mockRejectedValueOnce(new TestReminderDeliveryError());
      const failed = await call('POST', '/api/settings/payments/test-reminder');
      expect(failed.status).toBe(502);
      expect((await failed.json()).code).toBe('delivery_failed');
    });
  });

  describe('public payment link', () => {
    const view = { appointment: { serviceName: 'S', scheduledAt: '2026-01-01T00:00:00.000Z', amount: 10, currency: 'RUB', isPaid: false }, canPayOnline: true, manual: { bankTransfer: null, customLink: null, cash: null } };

    it('is reachable without authentication and maps domain errors', async () => {
      viewMock.mockResolvedValueOnce(view);
      const ok = await call('GET', '/api/public/payments/tok', undefined, {});
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual(view);

      viewMock.mockRejectedValueOnce(new PaymentLinkNotFoundError());
      expect((await call('GET', '/api/public/payments/bad', undefined, {})).status).toBe(404);
      viewMock.mockRejectedValueOnce(new PaymentLinkGoneError());
      expect((await call('GET', '/api/public/payments/old', undefined, {})).status).toBe(410);
    });

    it('creates a checkout and maps the failure modes', async () => {
      checkoutMock.mockResolvedValueOnce({ redirectUrl: 'https://pay.test/x' });
      const ok = await call('POST', '/api/public/payments/tok/checkout', undefined, {});
      expect(await ok.json()).toEqual({ redirectUrl: 'https://pay.test/x' });

      checkoutMock.mockRejectedValueOnce(new PaymentLinkNotFoundError());
      expect((await call('POST', '/api/public/payments/tok/checkout', undefined, {})).status).toBe(404);
      checkoutMock.mockRejectedValueOnce(new PaymentLinkGoneError());
      expect((await call('POST', '/api/public/payments/tok/checkout', undefined, {})).status).toBe(410);
      checkoutMock.mockRejectedValueOnce(new PaymentUnavailableError());
      const unavailable = await call('POST', '/api/public/payments/tok/checkout', undefined, {});
      expect(unavailable.status).toBe(409);
      expect((await unavailable.json()).code).toBe('payment_unavailable');
      checkoutMock.mockRejectedValueOnce(new ProviderUnreachableError());
      expect((await call('POST', '/api/public/payments/tok/checkout', undefined, {})).status).toBe(502);
    });
  });

  describe('webhooks', () => {
    const post = (path: string, body = '{"a":1}', extra: Record<string, string> = {}) =>
      fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body });

    it('passes the raw body, headers and account token to the pipeline', async () => {
      processWebhookMock.mockResolvedValue({ kind: 'processed', result: 'paid' });
      const response = await post('/api/integrations/bog/callback/acct-token', '{"a":  1}', { 'callback-signature': 'sig' });
      expect(response.status).toBe(200);
      const call0 = processWebhookMock.mock.calls[0][0];
      expect(call0.provider).toBe('bog');
      expect(call0.accountToken).toBe('acct-token');
      expect(call0.rawBody.toString()).toBe('{"a":  1}');
      expect(call0.headers['callback-signature']).toBe('sig');

      await post('/api/integrations/yookassa/webhook/yk-token');
      expect(processWebhookMock.mock.calls[1][0]).toMatchObject({ provider: 'yookassa', accountToken: 'yk-token' });
      await post('/api/integrations/stripe/webhook', '{}', { 'stripe-signature': 't=1,v1=2' });
      expect(processWebhookMock.mock.calls[2][0]).toMatchObject({ provider: 'stripe' });
    });

    it('answers 401 for a bad signature, 404 for an unknown account and 200 for duplicates', async () => {
      processWebhookMock.mockRejectedValueOnce(new InvalidSignatureError());
      expect((await post('/api/integrations/bog/callback/t')).status).toBe(401);
      processWebhookMock.mockResolvedValueOnce({ kind: 'unknown_account' });
      expect((await post('/api/integrations/yookassa/webhook/zzz')).status).toBe(404);
      processWebhookMock.mockResolvedValueOnce({ kind: 'duplicate_event' });
      expect((await post('/api/integrations/bog/callback/t')).status).toBe(200);
    });

    it('answers 404 when a verified event arrives before its order is stored (provider retries)', async () => {
      processWebhookMock.mockResolvedValueOnce({ kind: 'order_not_found' });
      expect((await post('/api/integrations/bog/callback/t')).status).toBe(404);
      processWebhookMock.mockResolvedValueOnce({ kind: 'order_not_found' });
      expect((await post('/api/integrations/stripe/webhook')).status).toBe(404);
    });

    it('answers 5xx on internal failure so the provider retries', async () => {
      processWebhookMock.mockRejectedValueOnce(new Error('db down'));
      expect((await post('/api/integrations/bog/callback/t')).status).toBe(500);
    });
  });

  describe('stripe oauth', () => {
    it('redirects the callback to the payments settings tab', async () => {
      const response = await fetch(`${baseUrl}/api/integrations/stripe/oauth/callback?error=access_denied`, { redirect: 'manual' });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('http://localhost:5173/settings/payments?stripe_oauth=error&reason=access_denied');
      const missing = await fetch(`${baseUrl}/api/integrations/stripe/oauth/callback`, { redirect: 'manual' });
      expect(missing.headers.get('location')).toContain('/settings/payments?stripe_oauth=error&reason=missing_code_or_state');
    });

    it('responds 503 with requiredEnv when Stripe is not configured, 403 for non-owners', async () => {
      const response = await call('POST', '/api/integrations/stripe/oauth/start');
      expect(response.status).toBe(503);
      const { requiredEnv } = await response.json();
      expect(requiredEnv).toContain('STRIPE_CLIENT_ID');
      expect(requiredEnv).not.toContain('STRIPE_WEBHOOK_SECRET');
      resolveUserByAccessTokenMock.mockResolvedValue({ ...owner, role: WebUserRole.Specialist });
      expect((await call('POST', '/api/integrations/stripe/oauth/start')).status).toBe(403);
    });
  });

  describe('mark-unpaid', () => {
    it('mirrors mark-paid: 200, 404 and 403 mapping', async () => {
      markUnpaidMock.mockResolvedValueOnce({ id: 4, paymentStatus: 'unpaid' });
      const ok = await call('POST', '/api/appointments/4/mark-unpaid');
      expect(ok.status).toBe(200);
      expect(markUnpaidMock).toHaveBeenCalledWith(expect.objectContaining({ accountId: 2 }), 4);
      markUnpaidMock.mockResolvedValueOnce(null);
      expect((await call('POST', '/api/appointments/4/mark-unpaid')).status).toBe(404);
      markUnpaidMock.mockRejectedValueOnce(new Error('FORBIDDEN_CLIENT'));
      expect((await call('POST', '/api/appointments/4/mark-unpaid')).status).toBe(403);
      expect((await call('POST', '/api/appointments/abc/mark-unpaid')).status).toBe(400);
    });
  });
});
