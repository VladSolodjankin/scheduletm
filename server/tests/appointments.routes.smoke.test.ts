import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getAppointmentsMock = vi.hoisted(() => vi.fn());
const createAppointmentForActorMock = vi.hoisted(() => vi.fn());
const rescheduleAppointmentForActorMock = vi.hoisted(() => vi.fn());
const cancelAppointmentForActorMock = vi.hoisted(() => vi.fn());
const markPaidAppointmentForActorMock = vi.hoisted(() => vi.fn());
const notifyAppointmentForActorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/appointmentService.js', () => ({
  getAppointments: getAppointmentsMock,
  updateAppointmentForActor: vi.fn(),
  createAppointmentForActor: createAppointmentForActorMock,
  rescheduleAppointmentForActor: rescheduleAppointmentForActorMock,
  cancelAppointmentForActor: cancelAppointmentForActorMock,
  markPaidAppointmentForActor: markPaidAppointmentForActorMock,
  notifyAppointmentForActor: notifyAppointmentForActorMock,
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

describe('appointments API route-smoke scenarios (mocked service layer)', () => {
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
    getAppointmentsMock.mockReset();
    rescheduleAppointmentForActorMock.mockReset();
    cancelAppointmentForActorMock.mockReset();
    markPaidAppointmentForActorMock.mockReset();
    notifyAppointmentForActorMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
    getAppointmentsMock.mockResolvedValue({
      appointments: [],
      specialists: [],
      clients: [],
      busySlots: [],
    });
  });

  it('list: forwards event filters to getAppointments', async () => {
    const response = await fetch(`${baseUrl}/api/appointments?specialistId=8&from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z&eventAction=cancel,notify&eventActorWebUserId=101&eventFrom=2026-04-10T00:00:00.000Z&eventTo=2026-04-20T23:59:59.999Z`, {
      method: 'GET',
      headers: {
        authorization: 'Bearer smoke-token',
      },
    });

    expect(response.status).toBe(200);
    expect(getAppointmentsMock).toHaveBeenCalledWith(
      authedUser,
      expect.objectContaining({
        specialistId: 8,
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
        eventAction: ['cancel', 'notify'],
        eventActorWebUserId: 101,
        eventFrom: '2026-04-10T00:00:00.000Z',
        eventTo: '2026-04-20T23:59:59.999Z',
      }),
    );
  });

  it('list: ignores invalid event filters (edge case)', async () => {
    const response = await fetch(`${baseUrl}/api/appointments?eventAction=cancel,unknown,event&eventActorWebUserId=abc`, {
      method: 'GET',
      headers: {
        authorization: 'Bearer smoke-token',
      },
    });

    expect(response.status).toBe(200);
    expect(getAppointmentsMock).toHaveBeenCalledWith(
      authedUser,
      expect.objectContaining({
        eventAction: ['cancel'],
        eventActorWebUserId: undefined,
      }),
    );
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
        appointmentAt: '2026-04-23T10:30:00.000Z',
        appointmentEndAt: '2026-04-23T11:00:00.000Z',
        firstName: 'Smoke',
        lastName: 'Client',
        username: 'smoke_client',
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

  it('mark-paid: POST /api/appointments/:id/mark-paid returns paid status', async () => {
    const paid = {
      id: 41,
      specialistId: 8,
      scheduledAt: '2026-04-24T13:00:00.000Z',
      durationMin: 30,
      status: 'confirmed',
      paymentStatus: 'paid',
      meetingLink: '',
      notes: '',
      events: [],
    };
    markPaidAppointmentForActorMock.mockResolvedValue(paid);

    const response = await fetch(`${baseUrl}/api/appointments/41/mark-paid`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentStatus: 'paid' });
  });

  it('notify: POST /api/appointments/:id/notify returns 200', async () => {
    const notified = {
      id: 41,
      specialistId: 8,
      scheduledAt: '2026-04-24T13:00:00.000Z',
      durationMin: 30,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      meetingLink: '',
      notes: '',
      events: [{ action: 'notify', createdAt: '2026-04-24T10:00:00.000Z' }],
    };
    notifyAppointmentForActorMock.mockResolvedValue(notified);

    const response = await fetch(`${baseUrl}/api/appointments/41/notify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(notified);
  });
});
