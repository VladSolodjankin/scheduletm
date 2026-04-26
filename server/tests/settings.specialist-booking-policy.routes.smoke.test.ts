import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getSpecialistBookingPolicyMock = vi.hoisted(() => vi.fn());
const updateSpecialistBookingPolicyMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/settingsService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/settingsService.js')>('../src/services/settingsService.js');
  return {
    ...actual,
    getSpecialistBookingPolicy: getSpecialistBookingPolicyMock,
    updateSpecialistBookingPolicy: updateSpecialistBookingPolicyMock,
  };
});

const authedUser = {
  id: '101',
  accountId: 1,
  email: 'specialist@example.com',
  role: WebUserRole.Specialist,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

describe('settings specialist booking policy route-smoke scenarios (mocked service layer)', () => {
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
    getSpecialistBookingPolicyMock.mockReset();
    updateSpecialistBookingPolicyMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('GET /api/settings/specialist-booking-policy returns booking policy', async () => {
    getSpecialistBookingPolicyMock.mockResolvedValue({
      specialistId: 7,
      cancelGracePeriodHours: 24,
      refundOnLateCancel: false,
      autoCancelUnpaidEnabled: true,
      unpaidAutoCancelAfterHours: 72,
    });

    const response = await fetch(`${baseUrl}/api/settings/specialist-booking-policy`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      specialistId: 7,
      autoCancelUnpaidEnabled: true,
    });
  });

  it('PUT /api/settings/specialist-booking-policy returns updated booking policy', async () => {
    updateSpecialistBookingPolicyMock.mockResolvedValue({
      specialistId: 7,
      cancelGracePeriodHours: 12,
      refundOnLateCancel: true,
      autoCancelUnpaidEnabled: true,
      unpaidAutoCancelAfterHours: 48,
    });

    const response = await fetch(`${baseUrl}/api/settings/specialist-booking-policy`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({
        cancelGracePeriodHours: 12,
        refundOnLateCancel: true,
        autoCancelUnpaidEnabled: true,
        unpaidAutoCancelAfterHours: 48,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      cancelGracePeriodHours: 12,
      refundOnLateCancel: true,
      unpaidAutoCancelAfterHours: 48,
    });
  });
});
