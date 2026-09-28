import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertNotificationJobMock = vi.hoisted(() => vi.fn());
const claimNotificationForDeliveryMock = vi.hoisted(() => vi.fn());
const heartbeatNotificationProcessingMock = vi.hoisted(() => vi.fn());
const markNotificationSentMock = vi.hoisted(() => vi.fn());
const markNotificationDeliveryFailureMock = vi.hoisted(() => vi.fn());
const sendAppointmentNotificationByTypeMock = vi.hoisted(() => vi.fn());
const trackServerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/notificationRepository.js', () => ({
  upsertNotificationJob: upsertNotificationJobMock,
  claimNotificationForDelivery: claimNotificationForDeliveryMock,
  heartbeatNotificationProcessing: heartbeatNotificationProcessingMock,
  markNotificationSent: markNotificationSentMock,
  markNotificationDeliveryFailure: markNotificationDeliveryFailureMock,
}));

vi.mock('../src/services/appointmentNotificationService.js', () => ({
  sendAppointmentNotificationByType: sendAppointmentNotificationByTypeMock,
}));

vi.mock('../src/services/errorTrackingService.js', () => ({
  trackServerError: trackServerErrorMock,
}));

const { enqueueTrackedAppointmentNotification, deliverAndMarkNotification } = await import(
  '../src/services/notificationDeliveryService.js'
);

const baseAppointment = {
  id: 10,
  account_id: 7,
  specialist_id: 2,
  user_id: 42,
  client_email: 'guest@example.com',
  client_telegram_id: '555',
} as unknown as import('../src/repositories/appointmentRepository.js').AppointmentRecord;

describe('notificationDeliveryService', () => {
  beforeEach(() => {
    upsertNotificationJobMock.mockReset().mockResolvedValue({ id: 1, status: 'pending', attempts: 0, max_attempts: 3 });
    claimNotificationForDeliveryMock.mockReset().mockResolvedValue('token');
    heartbeatNotificationProcessingMock.mockReset().mockResolvedValue(true);
    markNotificationSentMock.mockReset().mockResolvedValue(true);
    markNotificationDeliveryFailureMock.mockReset().mockResolvedValue(true);
    sendAppointmentNotificationByTypeMock.mockReset().mockResolvedValue({ delivered: true, channel: 'telegram' });
    trackServerErrorMock.mockReset().mockResolvedValue(undefined);
  });

  it('mints a unique type key per event so repeated events do not collide on the upsert conflict target', async () => {
    await enqueueTrackedAppointmentNotification({
      appointment: baseAppointment,
      notificationType: 'appointment_changed',
      now: new Date('2026-09-28T10:00:00.000Z'),
    });
    await enqueueTrackedAppointmentNotification({
      appointment: baseAppointment,
      notificationType: 'appointment_changed',
      now: new Date('2026-09-28T10:05:00.000Z'),
    });

    const typeKeys = upsertNotificationJobMock.mock.calls.map((call) => call[0].type);
    expect(typeKeys).toEqual([
      'appointment_changed:1790589600000',
      'appointment_changed:1790589900000',
    ]);
  });

  it('passes recipient email and chat id through and records the actually-delivered channel on success', async () => {
    const delivered = await enqueueTrackedAppointmentNotification({
      appointment: baseAppointment,
      notificationType: 'appointment_cancelled',
      now: new Date('2026-09-28T10:00:00.000Z'),
    });

    expect(delivered).toBe(true);
    expect(upsertNotificationJobMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'guest@example.com',
      recipientChatId: 555,
    }));
    expect(markNotificationSentMock).toHaveBeenCalledWith(expect.objectContaining({
      actualChannel: 'telegram',
    }));
  });

  it('never throws out of enqueueTrackedAppointmentNotification even when delivery blows up', async () => {
    sendAppointmentNotificationByTypeMock.mockRejectedValue(new Error('boom'));

    await expect(enqueueTrackedAppointmentNotification({
      appointment: baseAppointment,
      notificationType: 'appointment_created',
    })).resolves.toBe(false);

    expect(markNotificationDeliveryFailureMock).toHaveBeenCalled();
    expect(trackServerErrorMock).toHaveBeenCalled();
  });

  it('skips delivery attempts once the job is already sent or failed', async () => {
    upsertNotificationJobMock.mockResolvedValueOnce({ id: 1, status: 'sent', attempts: 1, max_attempts: 3 });

    const delivered = await deliverAndMarkNotification({
      appointmentId: 10,
      accountId: 7,
      userId: 42,
      email: 'guest@example.com',
      typeKey: 'appointment_created:1',
      sendAt: new Date('2026-09-28T10:00:00.000Z'),
      payload: {},
      heartbeatPath: '/test',
      sender: sendAppointmentNotificationByTypeMock,
    });

    expect(delivered).toBe(false);
    expect(claimNotificationForDeliveryMock).not.toHaveBeenCalled();
  });
});
