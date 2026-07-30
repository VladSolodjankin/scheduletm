import {
  listAppointmentsAllAccounts,
  listUnpaidAppointmentsCreatedBetweenAllAccounts,
} from '../repositories/appointmentRepository.js';
import {
  claimNotificationForDelivery,
  heartbeatNotificationProcessing,
  markNotificationDeliveryFailure,
  markNotificationSent,
  upsertNotificationJob,
} from '../repositories/notificationRepository.js';
import { sendAppointmentNotificationByType } from '../services/appointmentNotificationService.js';
import { trackServerError } from '../services/errorTrackingService.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_WINDOW_MIN = 10;
const PROCESSING_HEARTBEAT_MS = 5 * 60 * 1000;
let isRunInProgress = false;

const REMINDER_TIMINGS = [
  { key: '24h', minutesBefore: 24 * 60 },
  { key: '1h', minutesBefore: 60 },
] as const;

const PAYMENT_TIMINGS = [
  { key: '24h', minutesAfterCreate: 24 * 60 },
] as const;

function createWindow(now: Date, baseMinutes: number, windowMinutes: number, direction: 'future' | 'past') {
  const from = new Date(now);
  const to = new Date(now);

  if (direction === 'future') {
    from.setMinutes(from.getMinutes() + (baseMinutes - windowMinutes));
    to.setMinutes(to.getMinutes() + baseMinutes);
  } else {
    from.setMinutes(from.getMinutes() - baseMinutes);
    to.setMinutes(to.getMinutes() - (baseMinutes - windowMinutes));
  }

  return { from, to };
}

function safeDeliveryError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'delivery_failed';
  }
  return error.message.trim().slice(0, 500) || 'delivery_failed';
}

async function deliverAndMark(input: {
  appointmentId: number;
  accountId: number;
  userId: number;
  email: string;
  typeKey: string;
  sendAt: Date;
  payload: Record<string, unknown>;
  sender: () => Promise<{ delivered: boolean; reason?: string }>;
}) {
  const job = await upsertNotificationJob({
    accountId: input.accountId,
    appointmentId: input.appointmentId,
    userId: input.userId,
    type: input.typeKey,
    channel: 'email',
    sendAt: input.sendAt,
    recipientEmail: input.email,
    payload: input.payload,
  });

  if (job.status === 'sent' || job.status === 'failed') {
    return false;
  }

  const processingToken = await claimNotificationForDelivery({ notificationId: job.id, now: input.sendAt });
  if (!processingToken) {
    return false;
  }

  const heartbeat = setInterval(() => {
    void heartbeatNotificationProcessing({
      notificationId: job.id,
      processingToken,
    }).catch((error) => {
      void trackServerError({
        method: 'JOB',
        path: '/jobs/appointment-notifications/heartbeat',
        error,
      });
    });
  }, PROCESSING_HEARTBEAT_MS);

  let outcome:
    | { ok: true; result: { delivered: boolean; reason?: string } }
    | { ok: false; error: unknown } = { ok: false, error: new Error('delivery_not_started') };
  try {
    outcome = { ok: true, result: await input.sender() };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    clearInterval(heartbeat);
  }

  if (!outcome.ok) {
    await markNotificationDeliveryFailure({
      notificationId: job.id,
      processingToken,
      error: safeDeliveryError(outcome.error),
      now: input.sendAt,
    });
    throw outcome.error;
  }

  const { result } = outcome;
  if (result.delivered) {
    return markNotificationSent({
      notificationId: job.id,
      processingToken,
      recipientEmail: input.email,
      sentAt: input.sendAt,
    });
  }

  await markNotificationDeliveryFailure({
    notificationId: job.id,
    processingToken,
    error: result.reason ?? 'delivery_failed',
    now: input.sendAt,
  });

  return false;
}

export function startAppointmentNotificationsJob(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  return setInterval(() => {
    void runAppointmentNotificationsJob().catch((error) => {
      void trackServerError({
        method: 'JOB',
        path: '/jobs/appointment-notifications',
        error,
      });
    });
  }, intervalMs);
}

async function executeAppointmentNotificationsJob(now: Date, windowMinutes: number): Promise<number> {
  let deliveredCount = 0;

  for (const timing of REMINDER_TIMINGS) {
    const window = createWindow(now, timing.minutesBefore, windowMinutes, 'future');
    const appointments = await listAppointmentsAllAccounts({ from: window.from, to: window.to });

    for (const appointment of appointments) {
      const email = appointment.client_email?.trim() ?? '';
      if (!email) {
        continue;
      }

      const didDeliver = await deliverAndMark({
        appointmentId: appointment.id,
        accountId: appointment.account_id,
        userId: appointment.user_id,
        email,
        typeKey: `appointment_reminder:${timing.key}`,
        sendAt: now,
        payload: { timing: timing.key },
        sender: async () => {
          return sendAppointmentNotificationByType({
            accountId: appointment.account_id,
            appointment,
            notificationType: 'appointment_reminder',
          });
        },
      });

      if (didDeliver) {
        deliveredCount += 1;
      }
    }
  }

  for (const timing of PAYMENT_TIMINGS) {
    const window = createWindow(now, timing.minutesAfterCreate, windowMinutes, 'past');
    const appointments = await listUnpaidAppointmentsCreatedBetweenAllAccounts(window.from, window.to);

    for (const appointment of appointments) {
      const email = appointment.client_email?.trim() ?? '';
      if (!email) {
        continue;
      }

      const didDeliver = await deliverAndMark({
        appointmentId: appointment.id,
        accountId: appointment.account_id,
        userId: appointment.user_id,
        email,
        typeKey: `payment_reminder:${timing.key}`,
        sendAt: now,
        payload: { timing: timing.key },
        sender: async () => {
          return sendAppointmentNotificationByType({
            accountId: appointment.account_id,
            appointment,
            notificationType: 'payment_reminder',
          });
        },
      });

      if (didDeliver) {
        deliveredCount += 1;
      }
    }
  }

  return deliveredCount;
}

export async function runAppointmentNotificationsJob(
  now = new Date(),
  windowMinutes = DEFAULT_WINDOW_MIN,
): Promise<number> {
  if (isRunInProgress) {
    return 0;
  }

  isRunInProgress = true;
  try {
    return await executeAppointmentNotificationsJob(now, windowMinutes);
  } finally {
    isRunInProgress = false;
  }
}
