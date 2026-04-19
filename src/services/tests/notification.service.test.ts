import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/notification.repository', () => {
  return {
    createNotification: vi.fn(),
    findDueNotifications: vi.fn(),
    markNotificationFailed: vi.fn(),
    markNotificationSent: vi.fn(),
    scheduleNotificationRetry: vi.fn(),
    cancelPendingNotificationsByAppointment: vi.fn(),
  };
});

vi.mock('../../bot/bot', () => {
  return {
    sendMessage: vi.fn(),
  };
});

import { sendMessage } from '../../bot/bot';
import {
  createNotification,
  findDueNotifications,
  markNotificationFailed,
  markNotificationSent,
  scheduleNotificationRetry,
  cancelPendingNotificationsByAppointment,
} from '../../repositories/notification.repository';
import {
  cancelAppointmentReminders,
  processDueNotifications,
  queueAppointmentReminder,
  recreateAppointmentReminders,
} from '../notification.service';

describe('notification.service', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('queues notifications for all available channels', async () => {
    vi.mocked(createNotification).mockResolvedValue({ id: 1 } as any);

    await queueAppointmentReminder({
      accountId: 1,
      appointmentId: 10,
      userId: 20,
      appointmentAtIso: '2026-04-22T10:00:00.000Z',
      serviceName: 'Консультация',
      specialistName: 'Лилия',
      selectedDate: '2026-04-22',
      selectedTime: '13:00',
      chatId: 123,
      email: 'test@example.com',
      phone: '+70000000000',
    });

    expect(createNotification).toHaveBeenCalledTimes(3);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram' }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email' }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'sms' }),
    );
  });



  it('cancels pending reminders for appointment', async () => {
    await cancelAppointmentReminders(7, 88);

    expect(cancelPendingNotificationsByAppointment).toHaveBeenCalledWith(7, 88);
  });

  it('recreates reminders on reschedule', async () => {
    vi.mocked(createNotification).mockResolvedValue({ id: 1 } as any);

    await recreateAppointmentReminders({
      accountId: 1,
      appointmentId: 10,
      userId: 20,
      appointmentAtIso: '2026-04-22T10:00:00.000Z',
      serviceName: 'Консультация',
      specialistName: 'Лилия',
      selectedDate: '2026-04-22',
      selectedTime: '13:00',
      chatId: 123,
      email: 'test@example.com',
      phone: '+70000000000',
    });

    expect(cancelPendingNotificationsByAppointment).toHaveBeenCalledWith(1, 10);
    expect(createNotification).toHaveBeenCalledTimes(3);
  });
  it('marks telegram notification as sent', async () => {
    vi.mocked(findDueNotifications).mockResolvedValue([
      {
        id: 99,
        attempts: 0,
        maxAttempts: 3,
        channel: 'telegram',
        recipientChatId: 555,
        recipientEmail: null,
        recipientPhone: null,
        payload: {
          serviceName: 'Test',
          specialistName: 'Spec',
          selectedDate: '2026-04-22',
          selectedTime: '10:00',
        },
      },
    ] as any);

    const processed = await processDueNotifications();

    expect(processed).toBe(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(markNotificationSent).toHaveBeenCalledWith(99);
  });

  it('schedules retry for failed notification', async () => {
    vi.mocked(findDueNotifications).mockResolvedValue([
      {
        id: 77,
        attempts: 0,
        maxAttempts: 3,
        channel: 'telegram',
        recipientChatId: null,
        recipientEmail: null,
        recipientPhone: null,
        payload: {
          serviceName: 'Test',
          specialistName: 'Spec',
          selectedDate: '2026-04-22',
          selectedTime: '10:00',
        },
      },
    ] as any);

    await processDueNotifications();

    expect(scheduleNotificationRetry).toHaveBeenCalledTimes(1);
    expect(markNotificationFailed).not.toHaveBeenCalled();
  });
});
