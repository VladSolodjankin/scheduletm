import type { AppointmentRecord } from '../repositories/appointmentRepository.js';
import {
  claimNotificationForDelivery,
  heartbeatNotificationProcessing,
  markNotificationDeliveryFailure,
  markNotificationSent,
  upsertNotificationJob,
} from '../repositories/notificationRepository.js';
import { trackServerError } from './errorTrackingService.js';
import type { NotificationType } from './notificationSettingsService.js';

const PROCESSING_HEARTBEAT_MS = 5 * 60 * 1000;

export type NotificationSendResult = { delivered: boolean; channel?: 'email' | 'telegram' | null; reason?: string };

export function safeDeliveryError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'delivery_failed';
  }
  return error.message.trim().slice(0, 500) || 'delivery_failed';
}

async function attemptNotificationDelivery(input: {
  notificationId: number;
  email: string | null;
  chatId?: number | null;
  sendAt: Date;
  heartbeatPath: string;
  sender: () => Promise<NotificationSendResult>;
}): Promise<boolean> {
  const processingToken = await claimNotificationForDelivery({ notificationId: input.notificationId, now: input.sendAt });
  if (!processingToken) {
    return false;
  }

  const heartbeat = setInterval(() => {
    void heartbeatNotificationProcessing({
      notificationId: input.notificationId,
      processingToken,
    }).catch((error) => {
      void trackServerError({ method: 'JOB', path: input.heartbeatPath, error });
    });
  }, PROCESSING_HEARTBEAT_MS);

  let outcome: { ok: true; result: NotificationSendResult } | { ok: false; error: unknown } = {
    ok: false,
    error: new Error('delivery_not_started'),
  };
  try {
    outcome = { ok: true, result: await input.sender() };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    clearInterval(heartbeat);
  }

  if (!outcome.ok) {
    await markNotificationDeliveryFailure({
      notificationId: input.notificationId,
      processingToken,
      error: safeDeliveryError(outcome.error),
      now: input.sendAt,
    });
    throw outcome.error;
  }

  const { result } = outcome;
  if (result.delivered) {
    return markNotificationSent({
      notificationId: input.notificationId,
      processingToken,
      recipientEmail: input.email,
      recipientChatId: input.chatId ?? null,
      actualChannel: result.channel ?? undefined,
      sentAt: input.sendAt,
    });
  }

  await markNotificationDeliveryFailure({
    notificationId: input.notificationId,
    processingToken,
    error: result.reason ?? 'delivery_failed',
    now: input.sendAt,
  });

  return false;
}

export async function deliverAndMarkNotification(input: {
  appointmentId: number;
  accountId: number;
  userId: number;
  email: string | null;
  chatId?: number | null;
  typeKey: string;
  sendAt: Date;
  payload: Record<string, unknown>;
  heartbeatPath: string;
  sender: () => Promise<NotificationSendResult>;
}): Promise<boolean> {
  const job = await upsertNotificationJob({
    accountId: input.accountId,
    appointmentId: input.appointmentId,
    userId: input.userId,
    type: input.typeKey,
    channel: 'email',
    sendAt: input.sendAt,
    recipientEmail: input.email,
    recipientChatId: input.chatId ?? null,
    payload: input.payload,
  });

  if (job.status === 'sent' || job.status === 'failed') {
    return false;
  }

  return attemptNotificationDelivery({
    notificationId: job.id,
    email: input.email,
    chatId: input.chatId,
    sendAt: input.sendAt,
    heartbeatPath: input.heartbeatPath,
    sender: input.sender,
  });
}

function resolveChatId(appointment: AppointmentRecord): number | null {
  const raw = appointment.client_telegram_id?.trim();
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * Enqueues a tracked notification for an appointment lifecycle event
 * (created/changed/cancelled) and attempts delivery immediately, reusing the
 * same claim/retry/heartbeat machinery as the scheduled reminder job. Never
 * throws - failures are persisted for retry/resend and surfaced via
 * trackServerError, since the caller (booking/cancel/reschedule) must not
 * fail because a notification could not be sent.
 */
export async function enqueueTrackedAppointmentNotification(input: {
  appointment: AppointmentRecord;
  notificationType: NotificationType;
  now?: Date;
}): Promise<boolean> {
  const { sendAppointmentNotificationByType } = await import('./appointmentNotificationService.js');
  const sendAt = input.now ?? new Date();
  const email = input.appointment.client_email?.trim() || null;
  const chatId = resolveChatId(input.appointment);

  try {
    return await deliverAndMarkNotification({
      appointmentId: input.appointment.id,
      accountId: input.appointment.account_id,
      userId: input.appointment.user_id,
      email,
      chatId,
      typeKey: `${input.notificationType}:${sendAt.getTime()}`,
      sendAt,
      payload: {},
      heartbeatPath: '/jobs/appointment-notifications/immediate-heartbeat',
      sender: () =>
        sendAppointmentNotificationByType({
          accountId: input.appointment.account_id,
          appointment: input.appointment,
          notificationType: input.notificationType,
        }),
    });
  } catch (error) {
    void trackServerError({ method: 'JOB', path: '/jobs/appointment-notifications/immediate', error });
    return false;
  }
}

export { attemptNotificationDelivery };
