import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getNotificationLogsForActorMock = vi.hoisted(() => vi.fn());
const resendFailedNotificationForActorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/notificationLogService.js', () => ({
  getNotificationLogsForActor: getNotificationLogsForActorMock,
  resendFailedNotificationForActor: resendFailedNotificationForActorMock,
}));

const authedUser = {
  id: '101',
  accountId: 1,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

describe('notifications API route-smoke scenarios (mocked service layer)', () => {
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
    getNotificationLogsForActorMock.mockReset();
    resendFailedNotificationForActorMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('list: GET /api/notifications returns items', async () => {
    getNotificationLogsForActorMock.mockResolvedValue({
      items: [{
        id: 1,
        accountId: 10,
        specialistId: 20,
        userId: 30,
        appointmentId: 100,
        status: 'failed',
        type: 'appointment_reminder',
        channel: 'email',
        attempts: 3,
        maxAttempts: 3,
        recipientEmail: 'x@example.com',
        lastError: 'smtp failed',
        sendAt: '2026-04-27T10:00:00.000Z',
        nextRetryAt: null,
        sentAt: null,
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:05:00.000Z',
      }],
    });

    const response = await fetch(`${baseUrl}/api/notifications?accountId=10&specialistId=20&userId=30`, {
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ id: 1 }] });
  });

  it('resend: POST /api/notifications/:id/resend returns success message', async () => {
    resendFailedNotificationForActorMock.mockResolvedValue(true);

    const response = await fetch(`${baseUrl}/api/notifications/1/resend`, {
      method: 'POST',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ message: expect.any(String) });
  });
});
