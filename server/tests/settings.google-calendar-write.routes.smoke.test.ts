import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const findIntegrationMock = vi.hoisted(() => vi.fn());
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

  it('does not expose the removed write toggle fields in GET /user', async () => {
    findIntegrationMock.mockResolvedValue({
      google_api_key: 'token',
      google_granted_scopes: `${FREEBUSY} ${WRITE}`,
    });

    const res = await fetch(`${baseUrl}/api/settings/user`, { headers: { Authorization: 'Bearer t' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ googleConnected: true });
    expect(body).not.toHaveProperty('googleCalendarWriteEnabled');
    expect(body).not.toHaveProperty('googleCalendarWriteGranted');
  });

  it('starts oauth without a body and keeps the response shape', async () => {
    createGoogleOAuthUrlMock.mockResolvedValue({ url: 'https://accounts.google.com/x', state: 's' });

    const res = await fetch(`${baseUrl}/api/integrations/google/oauth/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ provider: 'google', authorizeUrl: 'https://accounts.google.com/x', state: 's' });
    expect(createGoogleOAuthUrlMock).toHaveBeenCalledWith('101', 1);
  });

  it('redirects the callback with success, or with calendar_write_required when write was not granted', async () => {
    const call = async (result: unknown) => {
      completeGoogleOAuthMock.mockResolvedValueOnce(result);
      const res = await fetch(`${baseUrl}/api/integrations/google/oauth/callback?state=s&code=c`, { redirect: 'manual' });
      return res.headers.get('location') ?? '';
    };

    expect(await call({ ok: true })).toMatch(/\/settings\?google_oauth=success$/);
    expect(await call({ ok: false, reason: 'calendar_write_required' }))
      .toMatch(/\/settings\?google_oauth=error&reason=calendar_write_required$/);
  });
});
