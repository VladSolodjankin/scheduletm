import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getAccountNotificationDefaultsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/settingsService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/settingsService.js')>('../src/services/settingsService.js');
  return {
    ...actual,
    getAccountNotificationDefaults: getAccountNotificationDefaultsMock,
  };
});

const authedUser = {
  id: '101',
  accountId: 1,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

describe('settings account notification defaults route-smoke scenarios (mocked service layer)', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

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
    resolveUserByAccessTokenMock.mockReset();
    getAccountNotificationDefaultsMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('GET /api/settings/account-notification-defaults returns defaults', async () => {
    getAccountNotificationDefaultsMock.mockResolvedValue([
      {
        notificationType: 'appointment_reminder',
        preferredChannel: 'email',
        enabled: true,
        sendTimings: ['24h', '1h'],
        frequency: 'immediate',
      },
    ]);

    const response = await fetch(`${baseUrl}/api/settings/account-notification-defaults`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [
        {
          notificationType: 'appointment_reminder',
          preferredChannel: 'email',
        },
      ],
    });
  });

  it('returns 403 for client role', async () => {
    resolveUserByAccessTokenMock.mockResolvedValue({ ...authedUser, role: WebUserRole.Client });

    const response = await fetch(`${baseUrl}/api/settings/account-notification-defaults`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(403);
  });
});
