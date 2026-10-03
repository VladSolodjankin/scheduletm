import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';
import { cancelAppointmentForActor, updateAppointmentForActor } from '../src/services/appointmentService.js';

const findAppointmentByIdMock = vi.hoisted(() => vi.fn());
const updateAppointmentMock = vi.hoisted(() => vi.fn());
const listAppointmentsMock = vi.hoisted(() => vi.fn());
const createAppointmentAuditEventMock = vi.hoisted(() => vi.fn());
const findWebUserByIdMock = vi.hoisted(() => vi.fn());
const enqueueTrackedAppointmentNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/appointmentRepository.js')>(
    '../src/repositories/appointmentRepository.js',
  );
  return {
    ...actual,
    findAppointmentById: findAppointmentByIdMock,
    updateAppointment: updateAppointmentMock,
    listAppointments: listAppointmentsMock,
    createAppointmentAuditEvent: createAppointmentAuditEventMock,
  };
});

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return {
    ...actual,
    findWebUserById: findWebUserByIdMock,
  };
});

vi.mock('../src/services/notificationDeliveryService.js', () => ({
  enqueueTrackedAppointmentNotification: enqueueTrackedAppointmentNotificationMock,
}));

const clientActor = {
  id: '55',
  accountId: 1,
  email: 'client@example.com',
  role: WebUserRole.Client,
} as any;

const existingAppointment = {
  id: 41,
  account_id: 1,
  specialist_id: 8,
  appointment_at: new Date('2026-04-23T10:30:00.000Z'),
  status: 'new',
  comment: null,
  meeting_link: null,
  meeting_provider: 'manual',
  location_address: null,
  duration_min: 30,
  is_paid: false,
  user_id: 20,
  service_id: 2,
  created_at: new Date('2026-04-01T00:00:00.000Z'),
  updated_at: new Date('2026-04-01T00:00:00.000Z'),
};

describe('client field-level appointment permissions', () => {
  beforeEach(() => {
    findAppointmentByIdMock.mockReset();
    updateAppointmentMock.mockReset();
    listAppointmentsMock.mockReset();
    createAppointmentAuditEventMock.mockReset();
    findWebUserByIdMock.mockReset();
    enqueueTrackedAppointmentNotificationMock.mockReset();

    findAppointmentByIdMock.mockResolvedValue(existingAppointment);
    findWebUserByIdMock.mockResolvedValue({ client_id: 20 });
    listAppointmentsMock.mockResolvedValue([existingAppointment]);
    updateAppointmentMock.mockResolvedValue(existingAppointment);
    enqueueTrackedAppointmentNotificationMock.mockResolvedValue(true);
  });

  it('allows a client to update only the notes field', async () => {
    await expect(updateAppointmentForActor(clientActor, 41, { notes: 'please be on time' })).resolves.toMatchObject({ id: 41 });
    expect(updateAppointmentMock).toHaveBeenCalledOnce();
  });

  it('rejects a client changing meetingLink/status/meetingProvider via the generic update', async () => {
    await expect(updateAppointmentForActor(clientActor, 41, { meetingLink: 'https://zoom.us/evil' }))
      .rejects.toThrow('FORBIDDEN_CLIENT_FIELDS');
    await expect(updateAppointmentForActor(clientActor, 41, { status: 'cancelled' }))
      .rejects.toThrow('FORBIDDEN_CLIENT_FIELDS');
    expect(updateAppointmentMock).not.toHaveBeenCalled();
  });

  it('still lets a client cancel their own appointment through the dedicated cancel action', async () => {
    updateAppointmentMock.mockResolvedValue({ ...existingAppointment, status: 'cancelled' });
    listAppointmentsMock.mockResolvedValue([{ ...existingAppointment, status: 'cancelled' }]);

    await expect(cancelAppointmentForActor(clientActor, 41)).resolves.toMatchObject({ status: 'cancelled' });
    expect(updateAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
  });
});
