import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { csrfCookieName } from '../src/utils/cookies.js';

const refreshAccessMock = vi.hoisted(() => vi.fn());
const issueSessionMock = vi.hoisted(() => vi.fn());
const logoutSessionMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/authService.js')>('../src/services/authService.js');
  return {
    ...actual,
    refreshAccess: refreshAccessMock,
    issueSession: issueSessionMock,
    logoutSession: logoutSessionMock,
  };
});

describe('auth refresh/logout csrf smoke scenarios', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  const refreshCookie = `${env.SESSION_COOKIE_NAME}=refresh-token`;
  const csrfCookie = `${csrfCookieName(env.SESSION_COOKIE_NAME)}=csrf-token`;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    refreshAccessMock.mockReset();
    issueSessionMock.mockReset();
    logoutSessionMock.mockReset();

    refreshAccessMock.mockResolvedValue({ userId: '42', accountId: 7 });
    issueSessionMock.mockResolvedValue('new-access-token');
    logoutSessionMock.mockResolvedValue(undefined);
  });

  it('POST /api/auth/refresh returns 403 without csrf header', async () => {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `${refreshCookie}; ${csrfCookie}`,
      },
    });

    expect(response.status).toBe(403);
    expect(refreshAccessMock).not.toHaveBeenCalled();
  });

  it('POST /api/auth/refresh returns 200 when csrf header matches cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `${refreshCookie}; ${csrfCookie}`,
        'x-csrf-token': 'csrf-token',
      },
    });

    expect(response.status).toBe(200);
    expect(refreshAccessMock).toHaveBeenCalledWith('refresh-token');
    expect(issueSessionMock).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({
      accessToken: 'new-access-token',
    });
  });

  it('POST /api/auth/logout returns 403 when csrf token mismatches', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer old-access-token',
        cookie: `${refreshCookie}; ${csrfCookie}`,
        'x-csrf-token': 'another-token',
      },
    });

    expect(response.status).toBe(403);
    expect(logoutSessionMock).not.toHaveBeenCalled();
  });

  it('POST /api/auth/logout returns 204 when csrf token is valid', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer old-access-token',
        cookie: `${refreshCookie}; ${csrfCookie}`,
        'x-csrf-token': 'csrf-token',
      },
    });

    expect(response.status).toBe(204);
    expect(logoutSessionMock).toHaveBeenCalledWith('refresh-token', 'old-access-token');
  });
});
