import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.hoisted(() => vi.fn());
const findIntegrationMock = vi.hoisted(() => vi.fn());
const updateIntegrationMock = vi.hoisted(() => vi.fn());
const clearCredentialsMock = vi.hoisted(() => vi.fn());
const createStateMock = vi.hoisted(() => vi.fn());
const consumeStateMock = vi.hoisted(() => vi.fn());

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return { ...actual, default: { ...actual.default, post: postMock } };
});

vi.mock('../src/repositories/webUserIntegrationRepository.js', () => ({
  findWebUserIntegrationByWebUserId: findIntegrationMock,
  updateWebUserYandexIntegration: updateIntegrationMock,
  clearWebUserYandexCredentials: clearCredentialsMock,
}));

vi.mock('../src/repositories/yandexOAuthStateRepository.js', () => ({
  createYandexOAuthState: createStateMock,
  consumeYandexOAuthState: consumeStateMock,
}));

import { AxiosError } from 'axios';
import { env } from '../src/config/env.js';
import { appointmentCreateSchema } from '../src/config/schemas.js';
import { createYandexTelemostMeeting } from '../src/services/yandexService.js';
import { completeYandexOAuth, createYandexOAuthUrl, disconnectYandexOAuth } from '../src/services/yandexOAuthService.js';

const httpError = (status: number) => new AxiosError('failed', String(status), undefined, undefined, {
  status,
  data: {},
  statusText: '',
  headers: {},
  config: {} as never,
});

const future = () => new Date(Date.now() + 3600_000);

describe('yandex telemost service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.YANDEX_OAUTH_CLIENT_ID = 'client-id';
    env.YANDEX_OAUTH_CLIENT_SECRET = 'client-secret';
    updateIntegrationMock.mockResolvedValue(undefined);
    findIntegrationMock.mockResolvedValue({
      yandex_access_token: 'access-1',
      yandex_refresh_token: 'refresh-1',
      yandex_token_expires_at: future(),
    });
  });

  it('creates a PUBLIC waiting-room conference with the OAuth header and stores last meeting', async () => {
    postMock.mockResolvedValueOnce({ data: { id: 'conf-1', join_url: 'https://telemost.yandex.ru/j/1' } });

    const result = await createYandexTelemostMeeting({ accountId: 1, userId: '55' });

    expect(result).toEqual({
      ok: true,
      meeting: { yandexMeetingId: 'conf-1', joinUrl: 'https://telemost.yandex.ru/j/1' },
    });
    expect(findIntegrationMock).toHaveBeenCalledWith(1, 55);
    expect(postMock).toHaveBeenCalledWith(
      'https://cloud-api.yandex.net/v1/telemost-api/conferences',
      { waiting_room_level: 'PUBLIC' },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'OAuth access-1' }) }),
    );
    expect(updateIntegrationMock).toHaveBeenCalledWith(expect.objectContaining({
      yandexLastMeetingId: 'conf-1',
      yandexLastJoinUrl: 'https://telemost.yandex.ru/j/1',
    }));
  });

  it('refreshes a near-expiry token first and keeps the old refresh token when none is returned', async () => {
    findIntegrationMock.mockResolvedValue({
      yandex_access_token: 'stale',
      yandex_refresh_token: 'refresh-1',
      yandex_token_expires_at: new Date(Date.now() + 10_000),
    });
    postMock
      .mockResolvedValueOnce({ data: { access_token: 'fresh', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: { id: 'c', join_url: 'https://telemost.yandex.ru/j/2' } });

    const result = await createYandexTelemostMeeting({ accountId: 1, userId: '55' });

    expect(result.ok).toBe(true);
    expect(postMock.mock.calls[0]?.[0]).toBe('https://oauth.yandex.ru/token');
    expect(String(postMock.mock.calls[0]?.[1])).toContain('grant_type=refresh_token');
    expect(updateIntegrationMock).toHaveBeenCalledWith(expect.objectContaining({
      yandexAccessToken: 'fresh',
      yandexRefreshToken: 'refresh-1',
    }));
    expect(postMock.mock.calls[1]?.[2]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'OAuth fresh' }),
    }));
  });

  it('refreshes once and retries when the API answers 401', async () => {
    postMock
      .mockRejectedValueOnce(httpError(401))
      .mockResolvedValueOnce({ data: { access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: { id: 'c', join_url: 'https://telemost.yandex.ru/j/3' } });

    const result = await createYandexTelemostMeeting({ accountId: 1, userId: '55' });

    expect(result.ok).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(3);
  });

  it('reports yandex_auth_failed when refresh is rejected with invalid_grant', async () => {
    findIntegrationMock.mockResolvedValue({
      yandex_access_token: 'stale',
      yandex_refresh_token: 'refresh-1',
      yandex_token_expires_at: new Date(Date.now() - 1000),
    });
    postMock.mockRejectedValueOnce(httpError(400));

    await expect(createYandexTelemostMeeting({ accountId: 1, userId: '55' })).resolves.toEqual({
      ok: false,
      reason: 'yandex_auth_failed',
    });
  });

  it('reports yandex_auth_failed when the retry refresh after a 401 fails', async () => {
    postMock
      .mockRejectedValueOnce(httpError(401))
      .mockRejectedValueOnce(httpError(400));

    await expect(createYandexTelemostMeeting({ accountId: 1, userId: '55' })).resolves.toEqual({
      ok: false,
      reason: 'yandex_auth_failed',
    });
  });

  it.each([402, 403, 410, 429, 503])('maps API status %i to yandex_create_failed', async (status) => {
    postMock.mockRejectedValueOnce(httpError(status));

    await expect(createYandexTelemostMeeting({ accountId: 1, userId: '55' })).resolves.toEqual({
      ok: false,
      reason: 'yandex_create_failed',
    });
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('reports not connected without tokens and not configured without client credentials', async () => {
    findIntegrationMock.mockResolvedValue(null);
    await expect(createYandexTelemostMeeting({ accountId: 1, userId: '55' })).resolves.toEqual({
      ok: false,
      reason: 'yandex_not_connected',
    });

    env.YANDEX_OAUTH_CLIENT_ID = '';
    await expect(createYandexTelemostMeeting({ accountId: 1, userId: '55' })).resolves.toEqual({
      ok: false,
      reason: 'yandex_not_configured',
    });
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('yandex oauth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.YANDEX_OAUTH_CLIENT_ID = 'client-id';
    env.YANDEX_OAUTH_CLIENT_SECRET = 'client-secret';
    env.API_BASE_URL = 'http://localhost:3003';
    env.YANDEX_OAUTH_REDIRECT_URI = 'http://localhost:3003/api/integrations/yandex/oauth/callback';
    updateIntegrationMock.mockResolvedValue(undefined);
  });

  it('builds an authorize URL with the Telemost scope and stores the state', async () => {
    const init = await createYandexOAuthUrl('55', 1);

    expect(init).not.toBeNull();
    const url = new URL(init!.url);
    expect(url.origin + url.pathname).toBe('https://oauth.yandex.ru/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('telemost-api:conferences.create');
    expect(url.searchParams.get('state')).toBe(init!.state);
    expect(createStateMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 1,
      webUserId: 55,
      stateToken: init!.state,
    }));
  });

  it('returns null when not configured', async () => {
    env.YANDEX_OAUTH_CLIENT_SECRET = '';
    await expect(createYandexOAuthUrl('55', 1)).resolves.toBeNull();
    expect(createStateMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown or expired state without exchanging the code', async () => {
    consumeStateMock.mockResolvedValue(null);

    await expect(completeYandexOAuth('bad', 'code')).resolves.toEqual({ ok: false, reason: 'invalid_state' });
    expect(postMock).not.toHaveBeenCalled();
    expect(updateIntegrationMock).not.toHaveBeenCalled();
  });

  it('exchanges the code and stores tokens for the state owner', async () => {
    consumeStateMock.mockResolvedValue({ account_id: 3, web_user_id: 9 });
    postMock.mockResolvedValueOnce({ data: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } });

    await expect(completeYandexOAuth('good', 'code')).resolves.toEqual({ ok: true });
    expect(String(postMock.mock.calls[0]?.[1])).toContain('grant_type=authorization_code');
    expect(updateIntegrationMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 3,
      webUserId: 9,
      yandexAccessToken: 'a',
      yandexRefreshToken: 'r',
    }));
  });

  it('reports token_exchange_failed when Yandex rejects the code', async () => {
    consumeStateMock.mockResolvedValue({ account_id: 3, web_user_id: 9 });
    postMock.mockRejectedValueOnce(httpError(400));

    await expect(completeYandexOAuth('good', 'code')).resolves.toEqual({
      ok: false,
      reason: 'token_exchange_failed',
    });
  });

  it('disconnects through the update-only clear and rejects non-numeric user ids', async () => {
    await expect(disconnectYandexOAuth('55', 1)).resolves.toBe(true);
    expect(clearCredentialsMock).toHaveBeenCalledWith(1, 55);
    await expect(disconnectYandexOAuth('abc', 1)).resolves.toBe(false);
  });
});

describe('meeting provider schema', () => {
  it('accepts yandex_telemost and rejects unknown providers', () => {
    const base = {
      specialistId: 1,
      clientId: 2,
      firstName: 'Ivan',
      lastName: 'Petrov',
      appointmentAt: '2026-05-02T10:00:00.000Z',
      appointmentEndAt: '2026-05-02T11:00:00.000Z',
    };
    expect(appointmentCreateSchema.safeParse({ ...base, meetingProvider: 'yandex_telemost' }).success).toBe(true);
    expect(appointmentCreateSchema.safeParse({ ...base, meetingProvider: 'google_meet' }).success).toBe(false);
  });
});
