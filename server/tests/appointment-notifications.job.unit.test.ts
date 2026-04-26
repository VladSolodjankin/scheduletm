import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAppointmentNotificationsJob } from '../src/jobs/appointmentNotifications.job.js';

const listAppointmentsAllAccountsMock = vi.hoisted(() => vi.fn());
const listUnpaidAppointmentsCreatedBetweenAllAccountsMock = vi.hoisted(() => vi.fn());
const hasSentNotificationMock = vi.hoisted(() => vi.fn());
const insertSentNotificationMock = vi.hoisted(() => vi.fn());
const sendAppointmentNotificationByTypeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', () => ({
  listAppointmentsAllAccounts: listAppointmentsAllAccountsMock,
  listUnpaidAppointmentsCreatedBetweenAllAccounts: listUnpaidAppointmentsCreatedBetweenAllAccountsMock,
}));

vi.mock('../src/repositories/notificationRepository.js', () => ({
  hasSentNotification: hasSentNotificationMock,
  insertSentNotification: insertSentNotificationMock,
}));

vi.mock('../src/services/appointmentNotificationService.js', () => ({
  sendAppointmentNotificationByType: sendAppointmentNotificationByTypeMock,
}));

describe('appointment notifications job unit', () => {
  beforeEach(() => {
    listAppointmentsAllAccountsMock.mockReset();
    listUnpaidAppointmentsCreatedBetweenAllAccountsMock.mockReset();
    hasSentNotificationMock.mockReset();
    insertSentNotificationMock.mockReset();
    sendAppointmentNotificationByTypeMock.mockReset();

    listAppointmentsAllAccountsMock.mockResolvedValue([]);
    listUnpaidAppointmentsCreatedBetweenAllAccountsMock.mockResolvedValue([]);
    hasSentNotificationMock.mockResolvedValue(false);
    sendAppointmentNotificationByTypeMock.mockResolvedValue({ delivered: true });
  });

  it('delivers reminder and writes sent notification once', async () => {
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([
      {
        id: 11,
        account_id: 2,
        specialist_id: 3,
        appointment_at: new Date('2026-04-27T12:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 8,
        service_id: 1,
        created_at: new Date('2026-04-26T12:00:00.000Z'),
        updated_at: new Date('2026-04-26T12:00:00.000Z'),
        client_email: 'client@test.com',
      },
    ]);

    const delivered = await runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));

    expect(delivered).toBe(1);
    expect(insertSentNotificationMock).toHaveBeenCalledOnce();
  });

  it('skips already sent notification (edge case dedupe)', async () => {
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([
      {
        id: 11,
        account_id: 2,
        specialist_id: 3,
        appointment_at: new Date('2026-04-27T12:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 8,
        service_id: 1,
        created_at: new Date('2026-04-26T12:00:00.000Z'),
        updated_at: new Date('2026-04-26T12:00:00.000Z'),
        client_email: 'client@test.com',
      },
    ]);
    hasSentNotificationMock.mockResolvedValue(true);

    const delivered = await runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));

    expect(delivered).toBe(0);
    expect(sendAppointmentNotificationByTypeMock).not.toHaveBeenCalled();
    expect(insertSentNotificationMock).not.toHaveBeenCalled();
  });
});
