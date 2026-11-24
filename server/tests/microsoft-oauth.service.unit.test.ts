import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

const stateRepo = vi.hoisted(() => ({ createMicrosoftOAuthState: vi.fn(), consumeMicrosoftOAuthState: vi.fn() }));
const integrationRepo = vi.hoisted(() => ({
  clearWebUserMicrosoftCredentials: vi.fn(),
  updateWebUserMicrosoftCredentials: vi.fn(),
  withLockedMicrosoftIntegration: vi.fn(),
}));

vi.mock('axios');
vi.mock('../src/repositories/microsoftOAuthStateRepository.js', () => stateRepo);
vi.mock('../src/repositories/webUserIntegrationRepository.js', () => integrationRepo);
vi.mock('../src/config/env.js', () => ({
  env: {
    PORT: 3003,
    API_BASE_URL: 'http://localhost:3003',
    MICROSOFT_OAUTH_CLIENT_ID: 'client',
    MICROSOFT_OAUTH_CLIENT_SECRET: 'secret',
    MICROSOFT_OAUTH_REDIRECT_URI: 'http://localhost:3003/api/integrations/microsoft/oauth/callback',
  },
}));

const service = await import('../src/services/microsoftOAuthService.js');

const record = (overrides: Record<string, unknown> = {}) => ({
  microsoft_access_token: 'stored-access',
  microsoft_refresh_token: 'refresh-1',
  microsoft_token_expires_at: new Date(Date.now() - 1000),
  ...overrides,
});

/** Runs the callback like the real helper: hands over the locked record plus a `save`. */
function lockedWith(row: Record<string, unknown> | null) {
  const save = vi.fn().mockResolvedValue(undefined);
  integrationRepo.withLockedMicrosoftIntegration.mockImplementation(
    async (_a: number, _u: number, work: (r: unknown, s: typeof save) => unknown) => (row ? work(row, save) : null),
  );
  return save;
}

describe('microsoftOAuthService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds the authorize URL with the fixed scopes and a stored state', async () => {
    const init = await service.createMicrosoftOAuthUrl('7', 3);
    const url = new URL(init!.url);
    expect(url.origin + url.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(url.searchParams.get('scope')).toBe('offline_access Calendars.ReadWrite User.Read');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3003/api/integrations/microsoft/oauth/callback');
    expect(stateRepo.createMicrosoftOAuthState).toHaveBeenCalledWith(expect.objectContaining({ accountId: 3, webUserId: 7, stateToken: init!.state }));
  });

  it('persists the rotated refresh token on every refresh', async () => {
    const save = lockedWith(record());
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600, scope: 'Calendars.ReadWrite' },
    });

    const result = await service.refreshMicrosoftAccessToken({ accountId: 3, webUserId: 7 });

    expect(result).toEqual({ ok: true, accessToken: 'access-2' });
    expect(String(vi.mocked(axios.post).mock.calls[0][1])).toContain('refresh_token=refresh-1');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-2', refreshToken: 'refresh-2' }));
  });

  it('keeps the old refresh token only when none is returned', async () => {
    const save = lockedWith(record());
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'a', expires_in: 3600 } });
    await service.refreshMicrosoftAccessToken({ accountId: 3, webUserId: 7 });
    expect(save.mock.calls[0][0].refreshToken).toBeUndefined();
  });

  it('reuses a token another worker refreshed while we waited for the lock', async () => {
    lockedWith(record({ microsoft_token_expires_at: new Date(Date.now() + 3600_000), microsoft_access_token: 'newer' }));

    const result = await service.refreshMicrosoftAccessToken({ accountId: 3, webUserId: 7, rejectedAccessToken: 'older' });

    expect(result).toEqual({ ok: true, accessToken: 'newer' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('refreshes when the stored token is the one that was just rejected', async () => {
    lockedWith(record({ microsoft_token_expires_at: new Date(Date.now() + 3600_000), microsoft_access_token: 'rejected' }));
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'fresh', refresh_token: 'r2', expires_in: 3600 } });

    const result = await service.refreshMicrosoftAccessToken({ accountId: 3, webUserId: 7, rejectedAccessToken: 'rejected' });

    expect(result).toEqual({ ok: true, accessToken: 'fresh' });
  });

  it('reports invalid_grant and other failures without saving', async () => {
    const save = lockedWith(record());
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { error: 'invalid_grant' } } });
    expect(await service.refreshMicrosoftAccessToken({ accountId: 3, webUserId: 7 })).toEqual({ ok: false, reason: 'invalid_grant' });

    vi.mocked(axios.post).mockRejectedValue({ response: { data: { error: 'temporarily_unavailable' } } });
    expect(await service.refreshMicrosoftAccessToken({ accountId: 3, webUserId: 7 })).toEqual({ ok: false, reason: 'refresh_failed' });
    expect(save).not.toHaveBeenCalled();
  });

  it('resolveUsable returns a valid token without any refresh', async () => {
    const result = await service.resolveUsableMicrosoftAccessToken({
      accountId: 3, webUserId: 7, accessToken: 'ok', refreshToken: 'r', expiresAt: new Date(Date.now() + 3600_000),
    });
    expect(result).toEqual({ ok: true, accessToken: 'ok' });
    expect(integrationRepo.withLockedMicrosoftIntegration).not.toHaveBeenCalled();
  });

  it('rejects a connection without calendar write and clears it', async () => {
    stateRepo.consumeMicrosoftOAuthState.mockResolvedValue({ account_id: 3, web_user_id: 7 });
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'User.Read' } });

    expect(await service.completeMicrosoftOAuth('s', 'c')).toEqual({ ok: false, reason: 'calendar_write_required' });
    expect(integrationRepo.clearWebUserMicrosoftCredentials).toHaveBeenCalledWith(3, 7);
    expect(integrationRepo.updateWebUserMicrosoftCredentials).not.toHaveBeenCalled();
  });

  it('stores credentials when Graph-URI scopes include calendar write', async () => {
    stateRepo.consumeMicrosoftOAuthState.mockResolvedValue({ account_id: 3, web_user_id: 7 });
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'https://graph.microsoft.com/Calendars.ReadWrite User.Read' },
    });

    expect(await service.completeMicrosoftOAuth('s', 'c')).toEqual({ ok: true });
    expect(integrationRepo.updateWebUserMicrosoftCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 3, webUserId: 7, accessToken: 'a', refreshToken: 'r' }),
    );
  });

  it('rejects an unknown state', async () => {
    stateRepo.consumeMicrosoftOAuthState.mockResolvedValue(null);
    expect(await service.completeMicrosoftOAuth('s', 'c')).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('maps authorize errors to stable reasons', async () => {
    expect(await service.failMicrosoftOAuth('s', 'access_denied', 'AADSTS65004: user declined')).toBe('access_denied');
    expect(await service.failMicrosoftOAuth('s', 'access_denied', 'AADSTS90094: admin consent required')).toBe('admin_consent_required');
    expect(await service.failMicrosoftOAuth('', 'server_error', '')).toBe('provider_error');
    expect(stateRepo.consumeMicrosoftOAuthState).toHaveBeenCalledTimes(2);
  });
});
