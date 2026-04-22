import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const createAppointmentForActorMock = vi.hoisted(() => vi.fn());
const rescheduleAppointmentForActorMock = vi.hoisted(() => vi.fn());
const cancelAppointmentForActorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/appointmentService.js', () => ({
  getAppointments: vi.fn(),
  updateAppointmentForActor: vi.fn(),
  createAppointmentForActor: createAppointmentForActorMock,
  rescheduleAppointmentForActor: rescheduleAppointmentForActorMock,
  cancelAppointmentForActor: cancelAppointmentForActorMock,
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

describe('appointments API smoke scenarios', () => {
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
    createAppointmentForActorMock.mockReset();
    rescheduleAppointmentForActorMock.mockReset();
    cancelAppointmentForActorMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('create: POST /api/appointments returns 201', async () => {
    const created = {
      id: 41,
      specialistId: 8,
      scheduledAt: '2026-04-23T10:30:00.000Z',
      durationMin: 30,
      status: 'new',
      meetingLink: '',
      notes: 'smoke create',
    };
    createAppointmentForActorMock.mockResolvedValue(created);

    const response = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({
        specialistId: 8,
        scheduledAt: '2026-04-23T10:30:00.000Z',
        durationMin: 30,
        status: 'new',
        notes: 'smoke create',
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject(created);
  });

  it('reschedule: POST /api/appointments/:id/reschedule returns 200', async () => {
    const updated = {
      id: 41,
      specialistId: 8,
      scheduledAt: '2026-04-24T13:00:00.000Z',
      durationMin: 30,
      status: 'new',
      meetingLink: '',
      notes: '',
    };
    rescheduleAppointmentForActorMock.mockResolvedValue(updated);

    const response = await fetch(`${baseUrl}/api/appointments/41/reschedule`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({ scheduledAt: '2026-04-24T13:00:00.000Z' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(updated);
  });

  it('cancel: POST /api/appointments/:id/cancel returns cancelled status', async () => {
    const cancelled = {
      id: 41,
      specialistId: 8,
      scheduledAt: '2026-04-24T13:00:00.000Z',
      durationMin: 30,
      status: 'cancelled',
      meetingLink: '',
      notes: 'cancelled by smoke',
    };
    cancelAppointmentForActorMock.mockResolvedValue(cancelled);

    const response = await fetch(`${baseUrl}/api/appointments/41/cancel`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(cancelled);
  });
});
