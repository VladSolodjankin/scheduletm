import type { AppointmentRecord } from '../repositories/appointmentRepository.js';
import { findSpecialistById } from '../repositories/specialistRepository.js';
import { findTelegramIntegrationByAccountId } from '../repositories/webUserIntegrationRepository.js';
import { sendAppointmentNotificationEmail } from './emailDeliveryService.js';
import { sendTelegramBotMessage } from './telegramService.js';
import {
  type NotificationChannel,
  getEffectiveNotificationSetting,
  type NotificationType,
} from './notificationSettingsService.js';

function resolveClientName(appointment: AppointmentRecord): string {
  return `${appointment.client_first_name ?? ''} ${appointment.client_last_name ?? ''}`.trim() || 'Клиент';
}

export async function sendAppointmentNotificationByType(input: {
  accountId: number;
  appointment: AppointmentRecord;
  notificationType: NotificationType;
  force?: boolean;
}): Promise<{ delivered: boolean; channel: 'email' | 'telegram' | null; reason?: string }> {
  const email = input.appointment.client_email?.trim() ?? '';
  const telegramUsername = input.appointment.client_username?.trim() ?? '';
  const telegramChatId = input.appointment.client_telegram_id?.trim() ?? '';

  let channelsToTry: NotificationChannel[] = ['telegram', 'email'];
  if (!input.force) {
    const active = await getEffectiveNotificationSetting({
      accountId: input.accountId,
      specialistId: input.appointment.specialist_id,
      clientId: input.appointment.user_id,
      notificationType: input.notificationType,
    });

    if (!active) {
      return { delivered: false, channel: null, reason: 'missing_settings' };
    }

    if (!active.enabled) {
      return { delivered: false, channel: null, reason: active.deniedByClient ? 'client_deny' : 'disabled' };
    }

    channelsToTry = active.deliveryChannels;
    if (channelsToTry.length === 0) {
      return { delivered: false, channel: null, reason: 'unsupported_channel' };
    }
  }

  const specialist = await findSpecialistById(input.accountId, input.appointment.specialist_id);
  for (const channel of channelsToTry) {
    if (channel === 'telegram') {
      if (!telegramChatId || !telegramUsername) {
        continue;
      }

      const integration = await findTelegramIntegrationByAccountId(input.accountId);
      const telegramToken = integration?.telegram_bot_token?.trim() ?? '';
      if (!telegramToken) {
        continue;
      }

      const delivered = await sendTelegramBotMessage(
        telegramToken,
        telegramChatId,
        `Напоминание: запись к ${specialist?.name ?? 'специалист'} на ${input.appointment.appointment_at.toISOString()}.`,
      );
      if (delivered) {
        return { delivered: true, channel: 'telegram' };
      }

      continue;
    }

    if (channel === 'email') {
      if (!email) {
        continue;
      }

      const delivered = await sendAppointmentNotificationEmail({
        to: email,
        clientName: resolveClientName(input.appointment),
        specialistName: specialist?.name ?? 'специалист',
        scheduledAt: input.appointment.appointment_at.toISOString(),
      });

      if (delivered) {
        return { delivered: true, channel: 'email' };
      }
    }
  }

  if (!telegramChatId && !email) {
    return { delivered: false, channel: null, reason: 'no_contact' };
  }

  return { delivered: false, channel: null, reason: 'delivery_failed' };
}
