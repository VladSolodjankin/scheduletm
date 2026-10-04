import { sendMessage } from '../bot/bot';
import { t as translate } from '../i18n';
import { sendBrevoEmail } from './email.service';
import { getAppSettings } from '../repositories/app-settings.repository';
import {
  createNotification,
  findDueNotifications,
  markNotificationFailed,
  markNotificationSent,
  NotificationChannel,
  scheduleNotificationRetry,
  cancelPendingNotificationsByAppointment,
} from '../repositories/notification.repository';

type QueueAppointmentReminderInput = {
  accountId: number;
  appointmentId: number;
  userId: number;
  appointmentAtIso: string;
  serviceName: string;
  specialistName: string;
  selectedDate: string;
  selectedTime: string;
  language?: 'ru' | 'en';
  chatId?: number;
  email?: string | null;
  phone?: string | null;
  reminderComment?: string | null;
};

export async function queueAppointmentReminder(input: QueueAppointmentReminderInput) {
  const channels: NotificationChannel[] = [];

  if (input.chatId) channels.push('telegram');
  if (input.email) channels.push('email');
  // SMS is not a wired-up delivery channel yet (see TODO.md backlog) — don't
  // queue a notification we have no way to actually send.

  if (!channels.length) {
    return [];
  }

  const settings = await getAppSettings(input.accountId);
  const offsets = settings.reminderOffsetsMin;

  const appointmentTs = new Date(input.appointmentAtIso).getTime();
  const nowTs = Date.now();

  const payload = {
    serviceName: input.serviceName,
    specialistName: input.specialistName,
    selectedDate: input.selectedDate,
    selectedTime: input.selectedTime,
    reminderComment: (input.reminderComment ?? '').trim(),
    language: input.language ?? 'ru',
  };

  return Promise.all(
    offsets.flatMap((offsetMin) => {
      const sendAt = new Date(appointmentTs - offsetMin * 60 * 1000);
      const sendAtIso = sendAt.getTime() > nowTs ? sendAt.toISOString() : new Date(nowTs).toISOString();
      const type = `appointment_reminder_${offsetMin}m`;

      return channels.map((channel) =>
        createNotification({
          accountId: input.accountId,
          appointmentId: input.appointmentId,
          userId: input.userId,
          type,
          channel,
          sendAt: sendAtIso,
          payload,
          recipient: {
            chatId: input.chatId,
            email: input.email ?? undefined,
            phone: input.phone ?? undefined,
          },
        }),
      );
    }),
  );
}

export async function cancelAppointmentReminders(accountId: number, appointmentId: number) {
  await cancelPendingNotificationsByAppointment(accountId, appointmentId);
}

export async function recreateAppointmentReminders(input: QueueAppointmentReminderInput) {
  await cancelPendingNotificationsByAppointment(input.accountId, input.appointmentId);
  return queueAppointmentReminder(input);
}

export async function processDueNotifications(limit = 100) {
  const notifications = await findDueNotifications(limit);

  for (const notification of notifications) {
    try {
      await dispatchNotification(notification.channel, {
        recipientChatId: notification.recipientChatId,
        recipientEmail: notification.recipientEmail,
        recipientPhone: notification.recipientPhone,
        payload: notification.payload,
      });

      await markNotificationSent(notification.id);
    } catch (error) {
      const attempts = notification.attempts + 1;
      const lastError = error instanceof Error ? error.message : 'Unknown notification error';

      if (attempts >= notification.maxAttempts) {
        await markNotificationFailed(notification.id, attempts, lastError);
        continue;
      }

      const backoffMinutes = Math.min(5 * 2 ** (attempts - 1), 120);
      const nextRetryAtIso = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
      await scheduleNotificationRetry(notification.id, attempts, nextRetryAtIso, lastError);
    }
  }

  return notifications.length;
}

async function sendReminderEmail(to: string, message: string, language: 'ru' | 'en'): Promise<void> {
  const subject = translate(language, 'notifications.appointmentReminderEmailSubject');
  const htmlContent = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;white-space:pre-line;">${message}</div>`;

  await sendBrevoEmail({ to, subject, htmlContent, textContent: message });
}

type DispatchInput = {
  recipientChatId: number | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  payload: Record<string, unknown>;
};

async function dispatchNotification(channel: NotificationChannel, input: DispatchInput) {
  const message = buildReminderText(input.payload);

  if (channel === 'telegram') {
    if (!input.recipientChatId) {
      throw new Error('Missing Telegram chat id');
    }

    await sendMessage(input.recipientChatId, message);
    return;
  }

  if (channel === 'email') {
    if (!input.recipientEmail) {
      throw new Error('Missing email recipient');
    }

    const language = (input.payload.language === 'en' ? 'en' : 'ru') as 'ru' | 'en';
    await sendReminderEmail(input.recipientEmail, message, language);
    return;
  }

  throw new Error(`Notification channel "${channel}" is not implemented`);
}

function buildReminderText(payload: Record<string, unknown>) {
  const language = (payload.language === 'en' ? 'en' : 'ru') as 'ru' | 'en';
  const serviceName = String(payload.serviceName ?? '');
  const specialistName = String(payload.specialistName ?? '');
  const selectedDate = String(payload.selectedDate ?? '');
  const selectedTime = String(payload.selectedTime ?? '');
  const reminderComment = String(payload.reminderComment ?? '').trim();

  const base = translate(language, 'notifications.appointmentReminder', {
    service: serviceName,
    specialist: specialistName,
    date: selectedDate,
    time: selectedTime,
  });

  if (!reminderComment) {
    return base;
  }

  const comment = translate(language, 'notifications.appointmentReminderComment', {
    comment: reminderComment,
  });

  return `${base}\n${comment}`;
}
