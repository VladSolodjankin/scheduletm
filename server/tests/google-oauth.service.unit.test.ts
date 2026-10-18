import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.hoisted(() => vi.fn());
const createStateMock = vi.hoisted(() => vi.fn());
const consumeStateMock = vi.hoisted(() => vi.fn());
const updateCredentialsMock = vi.hoisted(() => vi.fn());
const clearCredentialsMock = vi.hoisted(() => vi.fn());
const setWriteEnabledMock = vi.hoisted(() => vi.fn());

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return { ...actual, default: { ...actual.default, post: postMock } };
});

vi.mock('../src/repositories/googleOAuthStateRepository.js', () => ({
  createGoogleOAuthState: createStateMock,
  consumeGoogleOAuthState: consumeStateMock,
}));

vi.mock('../src/repositories/webUserIntegrationRepository.js', () => ({
  updateWebUserGoogleCredentials: updateCredentialsMock,
  clearWebUserGoogleCredentials: clearCredentialsMock,
  updateWebUserGoogleCalendarWriteEnabled: setWriteEnabledMock,
}));

import { env } from '../src/config/env.js';
import {
  completeGoogleOAuth,
  createGoogleOAuthUrl,
  refreshGoogleAccessToken,
} from '../src/services/googleOAuthService.js';

const WRITE = 'https://www.googleapis.com/auth/calendar.events.owned';
const FREEBUSY = 'https://www.googleapis.com/auth/calendar.freebusy';

const scopeOf = (url: string) => new URL(url).searchParams.get('scope')?.split(' ') ?? [];

describe('google oauth service scopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
    env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3003/api/integrations/google/oauth/callback';
    env.GOOGLE_OAUTH_SCOPES = '';
    env.GOOGLE_OAUTH_WRITE_SCOPE = WRITE;
    createStateMock.mockResolvedValue(undefined);
    updateCredentialsMock.mockResolvedValue(undefined);
    setWriteEnabledMock.mockResolvedValue(undefined);
  });

  it('requests only identity and freebusy scopes by default', async () => {
    const init = await createGoogleOAuthUrl('5', 1);

    expect(scopeOf(init!.url)).toEqual(['openid', 'https://www.googleapis.com/auth/userinfo.email', FREEBUSY]);
    expect(new URL(init!.url).searchParams.get('include_granted_scopes')).toBe('true');
    expect(createStateMock).toHaveBeenCalledWith(expect.objectContaining({ requestedAccess: null }));
  });

  it('adds the write scope and records the requested access when access=write', async () => {
    const init = await createGoogleOAuthUrl('5', 1, 'write');

    expect(scopeOf(init!.url)).toEqual([
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      FREEBUSY,
      WRITE,
    ]);
    expect(createStateMock).toHaveBeenCalledWith(expect.objectContaining({ requestedAccess: 'write' }));
  });

  it('honours GOOGLE_OAUTH_SCOPES override without duplicating the write scope', async () => {
    env.GOOGLE_OAUTH_SCOPES = `openid ${WRITE}`;
    const init = await createGoogleOAuthUrl('5', 1, 'write');

    expect(scopeOf(init!.url)).toEqual(['openid', WRITE]);
  });

  it('persists the granted scopes returned by the token exchange', async () => {
    consumeStateMock.mockResolvedValue({ account_id: 1, web_user_id: 5, requested_access: 'write' });
    postMock.mockResolvedValue({
      data: {
        access_token: 'a',
        refresh_token: 'r',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: `openid ${FREEBUSY} ${WRITE}`,
      },
    });

    const result = await completeGoogleOAuth('state', 'code');

    expect(updateCredentialsMock).toHaveBeenCalledWith(expect.objectContaining({
      googleGrantedScopes: `openid ${FREEBUSY} ${WRITE}`,
    }));
    expect(result).toMatchObject({ ok: true, requestedAccess: 'write', writeScopeGranted: true });
    expect(setWriteEnabledMock).not.toHaveBeenCalled();
  });

  it('reports a missing write scope when the user unticked it (granular consent)', async () => {
    consumeStateMock.mockResolvedValue({ account_id: 1, web_user_id: 5, requested_access: 'write' });
    postMock.mockResolvedValue({
      data: { access_token: 'a', expires_in: 3600, token_type: 'Bearer', scope: `openid ${FREEBUSY}` },
    });

    const result = await completeGoogleOAuth('state', 'code');

    expect(updateCredentialsMock).toHaveBeenCalledWith(expect.objectContaining({
      googleGrantedScopes: `openid ${FREEBUSY}`,
    }));
    expect(result).toMatchObject({ ok: true, requestedAccess: 'write', writeScopeGranted: false });
    expect(setWriteEnabledMock).toHaveBeenCalledWith(1, 5, false);
  });

  it('replaces stored scopes with the full set on re-consent without a write request for plain connects', async () => {
    consumeStateMock.mockResolvedValue({ account_id: 1, web_user_id: 5, requested_access: null });
    postMock.mockResolvedValue({
      data: { access_token: 'a', expires_in: 3600, token_type: 'Bearer', scope: `${FREEBUSY} ${WRITE}` },
    });

    const result = await completeGoogleOAuth('state', 'code');

    expect(updateCredentialsMock).toHaveBeenCalledWith(expect.objectContaining({
      googleGrantedScopes: `${FREEBUSY} ${WRITE}`,
    }));
    expect(result).toMatchObject({ ok: true, requestedAccess: null });
    expect(setWriteEnabledMock).not.toHaveBeenCalled();
  });

  it('updates granted scopes when a token refresh returns scope', async () => {
    postMock.mockResolvedValue({
      data: { access_token: 'new', expires_in: 3600, token_type: 'Bearer', scope: FREEBUSY },
    });

    await refreshGoogleAccessToken({ accountId: 1, webUserId: 5, refreshToken: 'r' });

    expect(updateCredentialsMock).toHaveBeenCalledWith(expect.objectContaining({ googleGrantedScopes: FREEBUSY }));
  });

  it('leaves granted scopes untouched when a refresh response has no scope', async () => {
    postMock.mockResolvedValue({ data: { access_token: 'new', expires_in: 3600, token_type: 'Bearer' } });

    await refreshGoogleAccessToken({ accountId: 1, webUserId: 5, refreshToken: 'r' });

    expect(updateCredentialsMock.mock.calls[0][0].googleGrantedScopes).toBeUndefined();
  });
});
