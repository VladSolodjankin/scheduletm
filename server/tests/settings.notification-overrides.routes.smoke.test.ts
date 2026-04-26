import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getSpecialistNotificationSettingsMock = vi.hoisted(() => vi.fn());
const getClientNotificationSettingsMock = vi.hoisted(() => vi.fn());
const getEffectiveNotificationSettingMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/settingsService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/settingsService.js')>('../src/services/settingsService.js');
  return {
    ...actual,
    getSpecialistNotificationSettings: getSpecialistNotificationSettingsMock,
    getClientNotificationSettings: getClientNotificationSettingsMock,
    getEffectiveNotificationSetting: getEffectiveNotificationSettingMock,
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

describe('settings notification overrides routes smoke', () => {
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
    getSpecialistNotificationSettingsMock.mockReset();
    getClientNotificationSettingsMock.mockReset();
    getEffectiveNotificationSettingMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('GET /api/settings/specialist-notification-settings returns settings items', async () => {
    getSpecialistNotificationSettingsMock.mockResolvedValue([
      { notificationType: 'appointment_reminder', preferredChannel: 'email', enabled: true, sendTimings: ['24h'], frequency: 'immediate' },
    ]);

    const response = await fetch(`${baseUrl}/api/settings/specialist-notification-settings?specialistId=5`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ notificationType: 'appointment_reminder' }] });
  });

  it('GET /api/settings/client-notification-settings returns 400 for unresolved client edge case', async () => {
    getClientNotificationSettingsMock.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/settings/client-notification-settings`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(400);
  });

  it('GET /api/settings/effective-notification-setting returns merged payload', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue({
      notificationType: 'appointment_reminder',
      preferredChannel: 'email',
      enabled: false,
      sendTimings: ['1h'],
      frequency: 'immediate',
      deniedByClient: true,
    });

    const response = await fetch(`${baseUrl}/api/settings/effective-notification-setting?notificationType=appointment_reminder&specialistId=5&clientId=7`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deniedByClient: true, enabled: false });
  });
});
