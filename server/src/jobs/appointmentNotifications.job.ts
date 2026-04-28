import {
  listAppointmentsAllAccounts,
  listUnpaidAppointmentsCreatedBetweenAllAccounts,
} from '../repositories/appointmentRepository.js';
import {
  claimNotificationForDelivery,
  markNotificationDeliveryFailure,
  markNotificationSent,
  upsertNotificationJob,
} from '../repositories/notificationRepository.js';
import { sendAppointmentNotificationByType } from '../services/appointmentNotificationService.js';
import { trackServerError } from '../services/errorTrackingService.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_WINDOW_MIN = 10;

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

  const claimed = await claimNotificationForDelivery({ notificationId: job.id, now: input.sendAt });
  if (!claimed) {
    return false;
  }

  const result = await input.sender();
  if (result.delivered) {
    await markNotificationSent({
      notificationId: job.id,
      recipientEmail: input.email,
      sentAt: input.sendAt,
    });
    return true;
  }

  await markNotificationDeliveryFailure({
    notificationId: job.id,
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

export async function runAppointmentNotificationsJob(now = new Date(), windowMinutes = DEFAULT_WINDOW_MIN): Promise<number> {
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
