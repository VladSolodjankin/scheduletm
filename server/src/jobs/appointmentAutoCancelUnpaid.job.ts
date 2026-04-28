import {
  autoCancelUnpaidAppointment,
  createAppointmentAuditEvent,
  listUnpaidActiveAppointmentsCreatedBeforeAllAccounts,
} from '../repositories/appointmentRepository.js';
import { findSpecialistBookingPolicy } from '../repositories/specialistBookingPolicyRepository.js';
import { trackServerError } from '../services/errorTrackingService.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_ELAPSED_MINUTES = 60;

function shouldAutoCancel(input: {
  now: Date;
  createdAt: Date;
  unpaidAutoCancelAfterHours: number;
}) {
  const elapsedMs = input.now.getTime() - input.createdAt.getTime();
  return elapsedMs >= input.unpaidAutoCancelAfterHours * 60 * 60 * 1000;
}

export function startAppointmentAutoCancelUnpaidJob(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  return setInterval(() => {
    void runAppointmentAutoCancelUnpaidJob().catch((error) => {
      void trackServerError({
        method: 'JOB',
        path: '/jobs/appointment-auto-cancel-unpaid',
        error,
      });
    });
  }, intervalMs);
}

export async function runAppointmentAutoCancelUnpaidJob(now = new Date()): Promise<number> {
  const minElapsed = new Date(now.getTime() - MIN_ELAPSED_MINUTES * 60 * 1000);
  const candidates = await listUnpaidActiveAppointmentsCreatedBeforeAllAccounts(minElapsed);
  const policyCache = new Map<string, Awaited<ReturnType<typeof findSpecialistBookingPolicy>>>();

  let cancelledCount = 0;
  for (const appointment of candidates) {
    const cacheKey = `${appointment.account_id}:${appointment.specialist_id}`;
    if (!policyCache.has(cacheKey)) {
      const policy = await findSpecialistBookingPolicy(appointment.account_id, appointment.specialist_id);
      policyCache.set(cacheKey, policy);
    }

    const policy = policyCache.get(cacheKey);
    if (!policy?.auto_cancel_unpaid_enabled) {
      continue;
    }

    if (!shouldAutoCancel({
      now,
      createdAt: appointment.created_at,
      unpaidAutoCancelAfterHours: policy.unpaid_auto_cancel_after_hours,
    })) {
      continue;
    }

    const cancelled = await autoCancelUnpaidAppointment({
      accountId: appointment.account_id,
      id: appointment.id,
    });
    if (!cancelled) {
      continue;
    }

    await createAppointmentAuditEvent({
      accountId: appointment.account_id,
      appointmentId: appointment.id,
      action: 'cancel',
      actorWebUserId: null,
      metadata: { reason: 'auto_cancel_unpaid' },
    });
    cancelledCount += 1;
  }

  return cancelledCount;
}
