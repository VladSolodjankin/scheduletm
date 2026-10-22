import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  activatePaymentProviderIfNoneActive: vi.fn(),
  clearActiveProviderIf: vi.fn(),
  deleteAccountPaymentProvider: vi.fn(),
  findAccountPaymentProvider: vi.fn(),
  findAccountPaymentSettings: vi.fn(),
  listAccountPaymentProviders: vi.fn(),
  setActivePaymentProvider: vi.fn(),
  upsertAccountPaymentProvider: vi.fn(),
  upsertManualPaymentSettings: vi.fn(),
}));
const connectMock = vi.hoisted(() => vi.fn());

vi.mock('../src/config/env.js', () => ({ env: { APP_ENCRYPTION_KEY: 'test-encryption-key', API_BASE_URL: 'https://api.test' } }));
vi.mock('../src/repositories/accountPaymentRepository.js', () => repo);
vi.mock('../src/services/payments/registry.js', () => ({ getPaymentAdapter: () => ({ connect: connectMock }) }));
vi.mock('../src/services/payments/stripeAdapter.js', () => ({ deauthorizeStripeAccount: vi.fn() }));

const service = await import('../src/services/paymentSettingsService.js');
const { encryptIntegrationSecret } = await import('../src/repositories/integrationSecretCrypto.js');
const { hashToken } = await import('../src/repositories/paymentTokenRepository.js');
const { maskSensitivePath } = await import('../src/utils/logMasking.js');

describe('payment settings service', () => {
  beforeEach(() => {
    Object.values(repo).forEach((mock) => mock.mockReset());
    connectMock.mockReset();
    repo.findAccountPaymentSettings.mockResolvedValue(null);
    repo.listAccountPaymentProviders.mockResolvedValue([]);
    repo.findAccountPaymentProvider.mockResolvedValue(null);
  });

  it('returns the empty default shape without secrets', async () => {
    const dto = await service.getPaymentSettings(3);
    expect(dto).toMatchObject({
      activeProvider: null,
      hasAnyMethod: false,
      providers: { stripe: { connected: false }, yookassa: { connected: false, hasSecret: false }, bog: { connected: false, hasSecret: false } },
      manual: { bankTransfer: { enabled: false, text: '' }, customLink: { enabled: false }, cash: { enabled: false } },
    });
    expect(dto.providers.yookassa.webhookUrl).toMatch(/^https:\/\/api\.test\/api\/integrations\/yookassa\/webhook\/[\w-]+$/);
    expect(dto.providers.bog.callbackUrl).toMatch(/\/api\/integrations\/bog\/callback\/[\w-]+$/);
  });

  it('exposes a stable per-account webhook URL whose hash is what gets stored', async () => {
    connectMock.mockResolvedValue({ config: { shopId: '1001' }, secret: 'secret-key' });
    await service.connectKeyedProvider(3, 'yookassa', { id: '1001', secret: 'secret-key' });
    const stored = repo.upsertAccountPaymentProvider.mock.calls[0][0];
    const token = service.deriveWebhookToken('yookassa', 3)!;
    expect(stored.webhookTokenHash).toBe(hashToken(token));
    expect(stored.secretEncrypted).not.toContain('secret-key');
    expect(service.deriveWebhookToken('yookassa', 4)).not.toBe(token);
    expect(service.deriveWebhookToken('bog', 3)).not.toBe(token);
    expect(repo.activatePaymentProviderIfNoneActive).toHaveBeenCalledWith(3, 'yookassa');
  });

  it('keeps the stored secret when re-saving without one, and requires one otherwise', async () => {
    repo.findAccountPaymentProvider.mockResolvedValue({ secret_encrypted: encryptIntegrationSecret('old-secret', 'x') });
    connectMock.mockResolvedValue({ config: { clientId: 'c' }, secret: 'old-secret' });
    await service.connectKeyedProvider(3, 'bog', { id: 'c', secret: '' });
    expect(connectMock).toHaveBeenCalledWith({ clientId: 'c', clientSecret: 'old-secret' });

    repo.findAccountPaymentProvider.mockResolvedValue(null);
    await expect(service.connectKeyedProvider(3, 'bog', { id: 'c' })).rejects.toBeInstanceOf(service.MissingProviderSecretError);
  });

  it('rejects activating a provider that is not connected', async () => {
    await expect(service.changeActiveProvider(3, 'bog')).rejects.toBeInstanceOf(service.ProviderNotConnectedError);
    expect(repo.setActivePaymentProvider).not.toHaveBeenCalled();
    await service.changeActiveProvider(3, null);
    expect(repo.setActivePaymentProvider).toHaveBeenCalledWith(3, null);
  });

  it('clears the active provider on disconnect', async () => {
    await service.disconnectProvider(3, 'bog');
    expect(repo.deleteAccountPaymentProvider).toHaveBeenCalledWith(3, 'bog');
    expect(repo.clearActiveProviderIf).toHaveBeenCalledWith(3, 'bog');
  });

  it('counts manual methods and an active connected provider as "has any method"', async () => {
    repo.findAccountPaymentSettings.mockResolvedValue({
      active_provider: null, bank_transfer_enabled: false, bank_transfer_text: 'x', custom_link_enabled: false,
      custom_link_title: '', custom_link_url: '', cash_enabled: true, cash_comment: '',
    });
    expect((await service.getPaymentSettings(3)).hasAnyMethod).toBe(true);
    repo.findAccountPaymentSettings.mockResolvedValue({
      active_provider: 'bog', bank_transfer_enabled: false, bank_transfer_text: '', custom_link_enabled: false,
      custom_link_title: '', custom_link_url: '', cash_enabled: false, cash_comment: '',
    });
    // active provider without a connected row does not count
    expect((await service.getPaymentSettings(3)).hasAnyMethod).toBe(false);
  });

  it('masks account tokens in logged paths', () => {
    expect(maskSensitivePath('/api/integrations/bog/callback/abcDEF123')).toBe('/api/integrations/bog/callback/:token');
    expect(maskSensitivePath('/api/integrations/yookassa/webhook/abc')).toBe('/api/integrations/yookassa/webhook/:token');
    expect(maskSensitivePath('/api/public/payments/tok/checkout')).toBe('/api/public/payments/:token/checkout');
    expect(maskSensitivePath('/api/settings/payments')).toBe('/api/settings/payments');
  });
});
