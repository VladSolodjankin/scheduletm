import {
  claimDueGoogleCalendarSyncItems,
  markGoogleCalendarSyncDone,
  markGoogleCalendarSyncFailed,
  markGoogleCalendarSyncRetry,
  purgeFinishedGoogleCalendarSyncItems,
} from '../repositories/googleCalendarSyncRepository.js';
import { trackServerError } from '../services/errorTrackingService.js';
import {
  computeGoogleSyncBackoffMs,
  GOOGLE_SYNC_MAX_ATTEMPTS,
  processGoogleCalendarSyncItem,
} from '../services/googleCalendarEventService.js';

const DEFAULT_INTERVAL_MS = 30 * 1000;
const BATCH_SIZE = 20;
const LEASE_MS = 5 * 60 * 1000;
const THROTTLE_MS = 150;
const FINISHED_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

let running = false;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

export function startGoogleCalendarSyncJob(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  return setInterval(() => {
    if (running) {
      return;
    }
    running = true;
    void runGoogleCalendarSyncJob()
      .catch((error) => {
        void trackServerError({
          method: 'JOB',
          path: '/jobs/google-calendar-sync',
          error,
        });
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
}

/** Claims due outbox rows and syncs them sequentially. Returns the number of rows processed. */
export async function runGoogleCalendarSyncJob(throttleMs = THROTTLE_MS): Promise<number> {
  const items = await claimDueGoogleCalendarSyncItems(BATCH_SIZE, LEASE_MS);

  for (const [index, item] of items.entries()) {
    if (index > 0 && throttleMs > 0) {
      await sleep(throttleMs);
    }

    const outcome = await processGoogleCalendarSyncItem(item);
    if (outcome.kind === 'done') {
      await markGoogleCalendarSyncDone(item.id, item.locked_until);
      continue;
    }

    const attempts = item.attempts + 1;
    console.error(
      `[googleCalendarSync] account=${item.account_id} appointment=${item.appointment_id} action=${item.action} status=${outcome.errorStatus} attempt=${attempts}`,
    );
    if (outcome.retryable && attempts < GOOGLE_SYNC_MAX_ATTEMPTS) {
      await markGoogleCalendarSyncRetry({
        id: item.id,
        attempts,
        nextAttemptAt: new Date(Date.now() + computeGoogleSyncBackoffMs(attempts)),
        errorStatus: outcome.errorStatus,
        lockedUntil: item.locked_until,
      });
    } else {
      await markGoogleCalendarSyncFailed({
        id: item.id,
        attempts,
        errorStatus: outcome.errorStatus,
        lockedUntil: item.locked_until,
      });
    }
  }

  if (items.length === 0) {
    await purgeFinishedGoogleCalendarSyncItems(new Date(Date.now() - FINISHED_RETENTION_MS));
  }

  return items.length;
}
