import {
  findAppointmentByIdAnyAccount,
  listAppointmentsAllAccounts,
  listUnpaidAppointmentsCreatedBetweenAllAccounts,
} from '../repositories/appointmentRepository.js';
import { listDueImmediateNotifications } from '../repositories/notificationRepository.js';
import { sendAppointmentNotificationByType } from '../services/appointmentNotificationService.js';
import { attemptNotificationDelivery, deliverAndMarkNotification } from '../services/notificationDeliveryService.js';
import { trackServerError } from '../services/errorTrackingService.js';
import type { NotificationType } from '../services/notificationSettingsService.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_WINDOW_MIN = 10;
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
  return deliverAndMarkNotification({
    ...input,
    heartbeatPath: '/jobs/appointment-notifications/heartbeat',
  });
}

async function runImmediateNotificationsRetrySweep(now: Date): Promise<number> {
  const dueRows = await listDueImmediateNotifications(now);
  let delivered = 0;

  for (const row of dueRows) {
    const appointment = await findAppointmentByIdAnyAccount(row.appointment_id);
    if (!appointment) {
      continue;
    }

    const notificationType = row.type.split(':')[0] as NotificationType;

    try {
      const didDeliver = await attemptNotificationDelivery({
        notificationId: row.id,
        email: appointment.client_email?.trim() || null,
        chatId: null,
        sendAt: now,
        heartbeatPath: '/jobs/appointment-notifications/immediate-retry-heartbeat',
        sender: () =>
          sendAppointmentNotificationByType({
            accountId: row.account_id,
            appointment,
            notificationType,
          }),
      });

      if (didDeliver) {
        delivered += 1;
      }
    } catch (error) {
      void trackServerError({ method: 'JOB', path: '/jobs/appointment-notifications/immediate-retry', error });
    }
  }

  return delivered;
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

  deliveredCount += await runImmediateNotificationsRetrySweep(now);

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
