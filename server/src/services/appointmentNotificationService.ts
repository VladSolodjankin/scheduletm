import { findAppointmentByIdAnyAccount, type AppointmentRecord } from '../repositories/appointmentRepository.js';
import { findSpecialistById } from '../repositories/specialistRepository.js';
import { findService } from '../repositories/serviceRepository.js';
import { env } from '../config/env.js';
import { findCustomBotTokenByAccountId } from '../repositories/telegramBotSettingsRepository.js';
import { sendAppointmentNotificationEmail } from './emailDeliveryService.js';
import { sendTelegramBotMessage } from './telegramService.js';
import { formatAppointmentDateTime } from '../utils/dateTimeFormat.js';
import { getOrCreateAppointmentManageUrl } from './appointmentManagementTokenService.js';
import {
  buildPaymentReminderContent,
  buildTelegramPaymentText,
  createPayUrl,
  evaluatePaymentReminderEligibility,
  resolveAccountNotificationLocale,
  type PaymentReminderContent,
} from './paymentReminderService.js';
import {
  type NotificationChannel,
  getEffectiveNotificationSetting,
  type NotificationType,
} from './notificationSettingsService.js';

const MANAGE_URL_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  'appointment_created',
  'appointment_changed',
  'appointment_reminder',
]);

function resolveClientName(appointment: AppointmentRecord): string {
  return `${appointment.client_first_name ?? ''} ${appointment.client_last_name ?? ''}`.trim() || 'Клиент';
}

// payment_reminder is built separately (buildTelegramPaymentText) because it carries the amount, Pay link and
// manual payment methods in the account locale.
const TELEGRAM_MESSAGE_BY_TYPE: Record<Exclude<NotificationType, 'payment_reminder'>, (specialistName: string, scheduledAt: string) => string> = {
  appointment_created: (specialistName, scheduledAt) => `Запись подтверждена: к ${specialistName} на ${scheduledAt}.`,
  appointment_changed: (specialistName, scheduledAt) => `Запись перенесена: к ${specialistName} на ${scheduledAt}.`,
  appointment_cancelled: (specialistName, scheduledAt) => `Запись к ${specialistName} на ${scheduledAt} отменена.`,
  appointment_reminder: (specialistName, scheduledAt) => `Напоминание: запись к ${specialistName} на ${scheduledAt}.`,
};

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

  // Defensive payment gate (the job gates before creating the notifications row): re-read the appointment so a
  // payment/cancellation that happened since the job loaded it is honoured, then require amount>0 + a method.
  let paymentContent: PaymentReminderContent | null = null;
  if (input.notificationType === 'payment_reminder') {
    const fresh = await findAppointmentByIdAnyAccount(input.appointment.id);
    const current = fresh
      ? { ...input.appointment, is_paid: fresh.is_paid, status: fresh.status, price: fresh.price, currency: fresh.currency }
      : input.appointment;
    const eligibility = await evaluatePaymentReminderEligibility(current);
    if (!eligibility.eligible) {
      return { delivered: false, channel: null, reason: 'payment_not_required' };
    }

    paymentContent = buildPaymentReminderContent({
      locale: await resolveAccountNotificationLocale(input.accountId),
      amount: eligibility.amount,
      currency: eligibility.currency,
      methods: eligibility.methods,
      payUrl: eligibility.payOnline ? await createPayUrl(input.appointment) : null,
    });
  }

  const specialist = await findSpecialistById(input.accountId, input.appointment.specialist_id);
  const timezone = specialist?.timezone || 'UTC';
  for (const channel of channelsToTry) {
    if (channel === 'telegram') {
      if (!telegramChatId || !telegramUsername) {
        continue;
      }

      // The account's own bot wins; otherwise the shared platform bot.
      const telegramToken = (await findCustomBotTokenByAccountId(input.accountId))?.trim() || env.TELEGRAM_BOT_TOKEN.trim();
      if (!telegramToken) {
        continue;
      }

      const specialistName = specialist?.name ?? 'специалист';
      const text = paymentContent
        ? buildTelegramPaymentText(
          paymentContent,
          specialistName,
          formatAppointmentDateTime(input.appointment.appointment_at, timezone, paymentContent.locale),
        )
        : (TELEGRAM_MESSAGE_BY_TYPE[input.notificationType as Exclude<NotificationType, 'payment_reminder'>]
          ?? TELEGRAM_MESSAGE_BY_TYPE.appointment_reminder)(specialistName, input.appointment.appointment_at.toISOString());
      const delivered = await sendTelegramBotMessage(telegramToken, telegramChatId, text);
      if (delivered) {
        return { delivered: true, channel: 'telegram' };
      }

      continue;
    }

    if (channel === 'email') {
      if (!email) {
        continue;
      }

      const [service, manageUrl] = await Promise.all([
        findService(input.accountId, input.appointment.service_id),
        MANAGE_URL_NOTIFICATION_TYPES.has(input.notificationType)
          ? getOrCreateAppointmentManageUrl(input.appointment)
          : Promise.resolve(undefined),
      ]);

      const locale = paymentContent?.locale;
      const delivered = await sendAppointmentNotificationEmail({
        to: email,
        clientName: resolveClientName(input.appointment),
        specialistName: specialist?.name ?? 'специалист',
        scheduledAt: formatAppointmentDateTime(input.appointment.appointment_at, timezone, locale),
        notificationType: input.notificationType,
        locale,
        manageUrl,
        serviceName: service?.name,
        durationMin: input.appointment.duration_min,
        meetingLink: input.appointment.meeting_link ?? undefined,
        meetingProvider: input.appointment.meeting_provider,
        locationAddress: input.appointment.location_address ?? undefined,
        payment: paymentContent
          ? {
            amountText: paymentContent.amountText,
            payUrl: paymentContent.payUrl,
            bankTransferText: paymentContent.bankTransferText,
            customLink: paymentContent.customLink,
            cashComment: paymentContent.cashComment,
          }
          : undefined,
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
