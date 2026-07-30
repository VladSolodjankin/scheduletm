import { purgeAppointmentEventsCreatedBefore } from '../repositories/appointmentRepository.js';
import { trackServerError } from '../services/errorTrackingService.js';

const RETENTION_DAYS = 365;
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
let isRunInProgress = false;

export async function runAppointmentAuditRetentionJob(now = new Date()): Promise<number> {
  if (isRunInProgress) return 0;

  isRunInProgress = true;
  try {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    return await purgeAppointmentEventsCreatedBefore(cutoff);
  } finally {
    isRunInProgress = false;
  }
}

function reportFailure(error: unknown) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  console.error('[jobs] appointment-audit-retention failed', normalized);
  void trackServerError({
    method: 'JOB',
    path: '/jobs/appointment-audit-retention',
    error: normalized,
  });
}

export function startAppointmentAuditRetentionJob(
  intervalMs = DAILY_INTERVAL_MS,
): NodeJS.Timeout {
  void runAppointmentAuditRetentionJob().catch(reportFailure);
  return setInterval(() => {
    void runAppointmentAuditRetentionJob().catch(reportFailure);
  }, intervalMs);
}
