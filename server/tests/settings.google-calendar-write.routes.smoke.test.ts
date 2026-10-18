import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const findIntegrationMock = vi.hoisted(() => vi.fn());
const updateWriteEnabledMock = vi.hoisted(() => vi.fn());
const completeGoogleOAuthMock = vi.hoisted(() => vi.fn());
const createGoogleOAuthUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/repositories/webUserIntegrationRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserIntegrationRepository.js')>(
    '../src/repositories/webUserIntegrationRepository.js',
  );
  return {
    ...actual,
    findWebUserIntegrationByWebUserId: findIntegrationMock,
    updateWebUserGoogleCalendarWriteEnabled: updateWriteEnabledMock,
    updateWebUserTelegramIntegration: vi.fn(),
  };
});

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return { ...actual, findWebUserById: vi.fn().mockResolvedValue(null), updateWebUserSettings: vi.fn() };
});

vi.mock('../src/repositories/userSettingsRepository.js', () => ({
  findUserSettingsByWebUserId: vi.fn().mockResolvedValue(null),
  updateUserSettingsByWebUserId: vi.fn(),
}));

vi.mock('../src/repositories/userIntegrationRepository.js', () => ({
  findUserIntegrationByWebUserId: vi.fn().mockResolvedValue(null),
  updateUserTelegramIntegration: vi.fn(),
}));

vi.mock('../src/services/googleOAuthService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/googleOAuthService.js')>(
    '../src/services/googleOAuthService.js',
  );
  return { ...actual, completeGoogleOAuth: completeGoogleOAuthMock, createGoogleOAuthUrl: createGoogleOAuthUrlMock };
});

import { env } from '../src/config/env.js';

const authedUser = {
  id: '101',
  accountId: 1,
  email: 'specialist@example.com',
  role: WebUserRole.Specialist,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

const WRITE = 'https://www.googleapis.com/auth/calendar.events.owned';
const FREEBUSY = 'https://www.googleapis.com/auth/calendar.freebusy';

describe('google calendar write setting and oauth start', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    env.GOOGLE_OAUTH_WRITE_SCOPE = WRITE;
    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
    findIntegrationMock.mockResolvedValue(null);
  });

  const put = (body: unknown) => fetch(`${baseUrl}/api/settings/user`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  it('returns the new fields from GET /user', async () => {
    findIntegrationMock.mockResolvedValue({
      google_api_key: 'token',
      google_calendar_write_enabled: true,
      google_granted_scopes: `${FREEBUSY} ${WRITE}`,
    });

    const res = await fetch(`${baseUrl}/api/settings/user`, { headers: { Authorization: 'Bearer t' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ googleCalendarWriteEnabled: true, googleCalendarWriteGranted: true });
  });

  it('defaults to disabled and not granted', async () => {
    const res = await fetch(`${baseUrl}/api/settings/user`, { headers: { Authorization: 'Bearer t' } });

    expect(await res.json()).toMatchObject({ googleCalendarWriteEnabled: false, googleCalendarWriteGranted: false });
  });

  it('rejects enabling when Google is not connected with 409 google_write_scope_missing', async () => {
    const res = await put({ googleCalendarWriteEnabled: true });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: 'google_write_scope_missing', message: expect.any(String) });
    expect(updateWriteEnabledMock).not.toHaveBeenCalled();
  });

  it('rejects enabling when only the freebusy scope is granted', async () => {
    findIntegrationMock.mockResolvedValue({ google_api_key: 'token', google_granted_scopes: FREEBUSY });

    const res = await put({ googleCalendarWriteEnabled: true });

    expect(res.status).toBe(409);
    expect(updateWriteEnabledMock).not.toHaveBeenCalled();
  });

  it('enables when the write scope is granted, scoped to the caller', async () => {
    findIntegrationMock.mockResolvedValue({ google_api_key: 'token', google_granted_scopes: `${FREEBUSY} ${WRITE}` });

    const res = await put({ googleCalendarWriteEnabled: true });

    expect(res.status).toBe(200);
    expect(updateWriteEnabledMock).toHaveBeenCalledWith(1, 101, true);
  });

  it('always allows disabling', async () => {
    const res = await put({ googleCalendarWriteEnabled: false });

    expect(res.status).toBe(200);
    expect(updateWriteEnabledMock).toHaveBeenCalledWith(1, 101, false);
  });

  it('passes access=write to the oauth start and keeps the response shape', async () => {
    createGoogleOAuthUrlMock.mockResolvedValue({ url: 'https://accounts.google.com/x', state: 's' });

    const res = await fetch(`${baseUrl}/api/integrations/google/oauth/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ access: 'write' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ provider: 'google', authorizeUrl: 'https://accounts.google.com/x', state: 's' });
    expect(createGoogleOAuthUrlMock).toHaveBeenCalledWith('101', 1, 'write');
  });

  it('keeps legacy behaviour without a body and rejects unknown access values', async () => {
    createGoogleOAuthUrlMock.mockResolvedValue({ url: 'u', state: 's' });
    const headers = { Authorization: 'Bearer t', 'Content-Type': 'application/json' };

    const plain = await fetch(`${baseUrl}/api/integrations/google/oauth/start`, { method: 'POST', headers });
    expect(plain.status).toBe(200);
    expect(createGoogleOAuthUrlMock).toHaveBeenCalledWith('101', 1, undefined);

    const bad = await fetch(`${baseUrl}/api/integrations/google/oauth/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ access: 'admin' }),
    });
    expect(bad.status).toBe(400);
  });

  it('adds scope_write to the callback redirect only when write access was requested', async () => {
    const call = async (result: unknown) => {
      completeGoogleOAuthMock.mockResolvedValueOnce(result);
      const res = await fetch(`${baseUrl}/api/integrations/google/oauth/callback?state=s&code=c`, { redirect: 'manual' });
      return res.headers.get('location') ?? '';
    };

    expect(await call({ ok: true, requestedAccess: null, writeScopeGranted: true }))
      .toMatch(/\/settings\?google_oauth=success$/);
    expect(await call({ ok: true, requestedAccess: 'write', writeScopeGranted: true }))
      .toMatch(/google_oauth=success&scope_write=granted$/);
    expect(await call({ ok: true, requestedAccess: 'write', writeScopeGranted: false }))
      .toMatch(/google_oauth=success&scope_write=missing$/);
  });
});
