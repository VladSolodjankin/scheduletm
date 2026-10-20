import {
  claimDueGoogleCalendarSyncItems,
  markGoogleCalendarSyncDone,
  markGoogleCalendarSyncFailed,
  markGoogleCalendarSyncRetry,
  purgeFinishedGoogleCalendarSyncItems,
  setGoogleCalendarSyncKickHandler,
} from '../repositories/googleCalendarSyncRepository.js';
import { trackServerError } from '../services/errorTrackingService.js';
import {
  computeGoogleSyncBackoffMs,
  GOOGLE_SYNC_MAX_ATTEMPTS,
  processGoogleCalendarSyncItem,
} from '../services/googleCalendarEventService.js';

const DEFAULT_INTERVAL_MS = 10 * 1000;
const BATCH_SIZE = 20;
const LEASE_MS = 5 * 60 * 1000;
const THROTTLE_MS = 150;
const FINISHED_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const PURGE_EVERY_MS = 60 * 60 * 1000;

let running = false;
let rerun = false;
let lastPurgeAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/** Runs one pass; passes never overlap in-process. A request made during a pass triggers exactly one follow-up pass. */
function runPass(): void {
  if (running) {
    rerun = true;
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
      if (rerun) {
        rerun = false;
        runPass();
      }
    });
}

/** Non-blocking, never throws: runs a pass right away (or right after the current one). */
export function kickGoogleCalendarSync(): void {
  try {
    runPass();
  } catch {
    // The interval job remains the safety net.
  }
}

export function startGoogleCalendarSyncJob(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  setGoogleCalendarSyncKickHandler(kickGoogleCalendarSync);
  return setInterval(runPass, intervalMs);
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

  if (items.length === 0 && Date.now() - lastPurgeAt >= PURGE_EVERY_MS) {
    lastPurgeAt = Date.now();
    await purgeFinishedGoogleCalendarSyncItems(new Date(Date.now() - FINISHED_RETENTION_MS));
  }

  return items.length;
}
