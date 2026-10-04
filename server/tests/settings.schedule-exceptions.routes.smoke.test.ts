import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const listScheduleExceptionsForActorMock = vi.hoisted(() => vi.fn());
const createScheduleExceptionForActorMock = vi.hoisted(() => vi.fn());
const deleteScheduleExceptionForActorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/settingsService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/settingsService.js')>('../src/services/settingsService.js');
  return {
    ...actual,
    listScheduleExceptionsForActor: listScheduleExceptionsForActorMock,
    createScheduleExceptionForActor: createScheduleExceptionForActorMock,
    deleteScheduleExceptionForActor: deleteScheduleExceptionForActorMock,
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

const clientUser = {
  ...authedUser,
  id: '202',
  email: 'client@example.com',
  role: WebUserRole.Client,
};

describe('settings schedule exceptions route-smoke scenarios (mocked service layer)', () => {
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
    listScheduleExceptionsForActorMock.mockReset();
    createScheduleExceptionForActorMock.mockReset();
    deleteScheduleExceptionForActorMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('GET /api/settings/specialist-schedule-exceptions returns the list', async () => {
    listScheduleExceptionsForActorMock.mockResolvedValue([
      { id: 1, specialistId: 7, date: '2026-11-03', type: 'vacation', startsAtMinute: null, endsAtMinute: null, note: null },
    ]);

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ id: 1, type: 'vacation' }]);
  });

  it('GET returns 400 when the specialist cannot be resolved', async () => {
    listScheduleExceptionsForActorMock.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/settings/specialist-schedule-exceptions creates an exception', async () => {
    createScheduleExceptionForActorMock.mockResolvedValue({
      id: 5, specialistId: 7, date: '2026-11-10', type: 'break', startsAtMinute: 720, endsAtMinute: 780, note: 'Lunch',
    });

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({
        date: '2026-11-10', type: 'break', startsAtMinute: 720, endsAtMinute: 780, note: 'Lunch',
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 5, type: 'break' });
  });

  it('POST returns 400 for an invalid payload', async () => {
    createScheduleExceptionForActorMock.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({ date: 'not-a-date', type: 'break' }),
    });

    expect(response.status).toBe(400);
  });

  it('DELETE /api/settings/specialist-schedule-exceptions/:id removes the exception', async () => {
    deleteScheduleExceptionForActorMock.mockResolvedValue(true);

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions/5`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(204);
  });

  it('DELETE returns 404 when the exception does not belong to the resolved specialist', async () => {
    deleteScheduleExceptionForActorMock.mockResolvedValue(false);

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions/999`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(404);
  });

  it('rejects a client role with 403', async () => {
    resolveUserByAccessTokenMock.mockResolvedValue(clientUser);

    const response = await fetch(`${baseUrl}/api/settings/specialist-schedule-exceptions`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(403);
  });
});
