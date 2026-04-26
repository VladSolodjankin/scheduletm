import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendAppointmentNotificationByType } from '../src/services/appointmentNotificationService.js';

const getAccountNotificationDefaultsMock = vi.hoisted(() => vi.fn());
const findSpecialistByIdMock = vi.hoisted(() => vi.fn());
const sendAppointmentNotificationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/notificationSettingsService.js', () => ({
  getAccountNotificationDefaults: getAccountNotificationDefaultsMock,
}));

vi.mock('../src/repositories/specialistRepository.js', () => ({
  findSpecialistById: findSpecialistByIdMock,
}));

vi.mock('../src/services/emailDeliveryService.js', () => ({
  sendAppointmentNotificationEmail: sendAppointmentNotificationEmailMock,
}));

describe('appointment notification service unit', () => {
  beforeEach(() => {
    getAccountNotificationDefaultsMock.mockReset();
    findSpecialistByIdMock.mockReset();
    sendAppointmentNotificationEmailMock.mockReset();
  });

  it('does not send when notification type disabled', async () => {
    getAccountNotificationDefaultsMock.mockResolvedValue([
      { notificationType: 'appointment_reminder', preferredChannel: 'email', enabled: false, sendTimings: ['24h'], frequency: 'immediate' },
    ]);

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date(),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_email: 'a@b.com',
      },
    });

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(sendAppointmentNotificationEmailMock).not.toHaveBeenCalled();
  });

  it('sends via email when enabled', async () => {
    getAccountNotificationDefaultsMock.mockResolvedValue([
      { notificationType: 'appointment_reminder', preferredChannel: 'email', enabled: true, sendTimings: ['24h'], frequency: 'immediate' },
    ]);
    findSpecialistByIdMock.mockResolvedValue({ name: 'Dr. Test' });
    sendAppointmentNotificationEmailMock.mockResolvedValue(true);

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date('2026-04-26T10:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_first_name: 'Ivan',
        client_last_name: 'Petrov',
        client_email: 'a@b.com',
      },
    });

    expect(result.delivered).toBe(true);
    expect(sendAppointmentNotificationEmailMock).toHaveBeenCalledOnce();
  });
});
