import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';

const resolveAppointmentByManagementTokenMock = vi.hoisted(() => vi.fn());
const cancelAppointmentByManagementTokenMock = vi.hoisted(() => vi.fn());
const rescheduleAppointmentByManagementTokenMock = vi.hoisted(() => vi.fn());
const findServiceMock = vi.hoisted(() => vi.fn());
const findSpecialistByIdAnyAccountMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/appointmentManagementTokenService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/appointmentManagementTokenService.js')>(
    '../src/services/appointmentManagementTokenService.js',
  );
  return {
    ...actual,
    resolveAppointmentByManagementToken: resolveAppointmentByManagementTokenMock,
    cancelAppointmentByManagementToken: cancelAppointmentByManagementTokenMock,
    rescheduleAppointmentByManagementToken: rescheduleAppointmentByManagementTokenMock,
  };
});

vi.mock('../src/repositories/serviceRepository.js', () => ({
  findService: findServiceMock,
}));

vi.mock('../src/repositories/specialistRepository.js', () => ({
  findSpecialistByIdAnyAccount: findSpecialistByIdAnyAccountMock,
}));

const futureAppointment = {
  id: 41,
  account_id: 1,
  specialist_id: 8,
  appointment_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  status: 'new' as const,
  comment: null,
  meeting_link: 'https://zoom.us/j/123',
  meeting_provider: 'zoom' as const,
  location_address: null,
  zoom_meeting_id: null,
  zoom_meeting_started_at: null,
  zoom_meeting_ended_at: null,
  duration_min: 30,
  is_paid: false,
  user_id: 20,
  service_id: 2,
  created_at: new Date(),
  updated_at: new Date(),
};

const pastCancelledAppointment = { ...futureAppointment, status: 'cancelled' as const, appointment_at: new Date(Date.now() - 60 * 60 * 1000) };

describe('public appointment management routes (mocked service layer)', () => {
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
    resolveAppointmentByManagementTokenMock.mockReset();
    cancelAppointmentByManagementTokenMock.mockReset();
    rescheduleAppointmentByManagementTokenMock.mockReset();
    findServiceMock.mockReset();
    findSpecialistByIdAnyAccountMock.mockReset();

    findServiceMock.mockResolvedValue({ name: 'Consultation' });
    findSpecialistByIdAnyAccountMock.mockResolvedValue({ name: 'Dr. Smith' });
  });

  it('GET /:token returns appointment details with manage capabilities', async () => {
    resolveAppointmentByManagementTokenMock.mockResolvedValue({ accountId: 1, appointment: futureAppointment });

    const response = await fetch(`${baseUrl}/api/public/appointment-management/valid-token`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'new',
      service: 'Consultation',
      specialist: 'Dr. Smith',
      canCancel: true,
      canReschedule: true,
      meeting: { provider: 'zoom', meetingUrl: 'https://zoom.us/j/123' },
    });
  });

  it('GET /:token returns 404 for an invalid or expired token', async () => {
    const { AppointmentManagementTokenError } = await import('../src/services/appointmentManagementTokenService.js');
    resolveAppointmentByManagementTokenMock.mockRejectedValue(new AppointmentManagementTokenError('TOKEN_INVALID'));

    const response = await fetch(`${baseUrl}/api/public/appointment-management/bad-token`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: 'not_found' });
  });

  it('POST /:token/cancel cancels a manageable appointment', async () => {
    resolveAppointmentByManagementTokenMock.mockResolvedValue({ accountId: 1, appointment: futureAppointment });
    cancelAppointmentByManagementTokenMock.mockResolvedValue({ ...futureAppointment, status: 'cancelled' });

    const response = await fetch(`${baseUrl}/api/public/appointment-management/valid-token/cancel`, { method: 'POST' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('cancelled');
    expect(cancelAppointmentByManagementTokenMock).toHaveBeenCalledWith('valid-token');
  });

  it('POST /:token/cancel refuses a past/cancelled appointment with 409 (edge case)', async () => {
    resolveAppointmentByManagementTokenMock.mockResolvedValue({ accountId: 1, appointment: pastCancelledAppointment });

    const response = await fetch(`${baseUrl}/api/public/appointment-management/valid-token/cancel`, { method: 'POST' });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'not_manageable' });
    expect(cancelAppointmentByManagementTokenMock).not.toHaveBeenCalled();
  });

  it('POST /:token/reschedule validates the body and reschedules', async () => {
    resolveAppointmentByManagementTokenMock.mockResolvedValue({ accountId: 1, appointment: futureAppointment });
    rescheduleAppointmentByManagementTokenMock.mockResolvedValue({
      ...futureAppointment,
      appointment_at: new Date('2026-05-01T10:00:00.000Z'),
    });

    const response = await fetch(`${baseUrl}/api/public/appointment-management/valid-token/reschedule`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheduledAt: '2026-05-01T10:00:00.000Z' }),
    });

    expect(response.status).toBe(200);
    expect(rescheduleAppointmentByManagementTokenMock).toHaveBeenCalledWith('valid-token', '2026-05-01T10:00:00.000Z');
  });

  it('POST /:token/reschedule returns 400 for an invalid body', async () => {
    const response = await fetch(`${baseUrl}/api/public/appointment-management/valid-token/reschedule`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheduledAt: 'not-a-date' }),
    });

    expect(response.status).toBe(400);
    expect(resolveAppointmentByManagementTokenMock).not.toHaveBeenCalled();
  });
});
