import { Knex } from 'knex';
import { db } from '../db/knex';
import { logWarn } from '../utils/logger';

type Executor = Knex | Knex.Transaction;

export type GoogleCalendarSyncEnqueueInput = {
  accountId: number;
  appointmentId: number;
  action: 'upsert' | 'delete';
  specialistId: number;
  /** Snapshot of an already-created Google event (copied from the appointment row). */
  googleEventId?: string | null;
  webUserId?: number | null;
};

/**
 * Cheap gate. The bot never talks to Google; it only records the change in the shared outbox
 * (`google_calendar_sync_queue`). The server job re-validates the granted write scope before any
 * Google call, so this gate only avoids writing rows for specialists without a Google connection.
 */
async function hasGoogleCalendarConnection(accountId: number, specialistId: number, executor: Executor) {
  const row = await executor('specialists as sp')
    .join('web_user_integrations as wui', function joinIntegrations() {
      this.on('wui.web_user_id', '=', 'sp.user_id').andOn('wui.account_id', '=', 'sp.account_id');
    })
    .where({
      'sp.account_id': accountId,
      'sp.id': specialistId,
    })
    .whereNotNull('wui.google_access_token_encrypted')
    .whereNotNull('wui.google_granted_scopes')
    .first('wui.web_user_id');

  return Boolean(row);
}

/**
 * Same coalescing contract as the server: at most one pending row per appointment,
 * a delete supersedes everything, a later upsert refreshes an older pending row.
 * Never throws: a failed enqueue must not fail the booking, cancel or reschedule.
 */
export async function enqueueGoogleCalendarSync(
  input: GoogleCalendarSyncEnqueueInput,
  executor: Executor = db,
): Promise<boolean> {
  try {
    const run = async (exec: Executor) => {
      const hasKnownEvent = input.action === 'delete' && Boolean(input.googleEventId);
      if (!hasKnownEvent && !(await hasGoogleCalendarConnection(input.accountId, input.specialistId, exec))) {
        return false;
      }

      await exec.raw(
        `INSERT INTO google_calendar_sync_queue
           (account_id, appointment_id, action, status, google_event_id, web_user_id, attempts, next_attempt_at, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, 0, now(), now(), now())
         ON CONFLICT (appointment_id) WHERE status = 'pending'
         DO UPDATE SET
           action = CASE WHEN google_calendar_sync_queue.action = 'delete' OR EXCLUDED.action = 'delete' THEN 'delete' ELSE 'upsert' END,
           google_event_id = COALESCE(EXCLUDED.google_event_id, google_calendar_sync_queue.google_event_id),
           web_user_id = COALESCE(EXCLUDED.web_user_id, google_calendar_sync_queue.web_user_id),
           attempts = 0,
           next_attempt_at = now(),
           updated_at = now()`,
        [input.accountId, input.appointmentId, input.action, input.googleEventId ?? null, input.webUserId ?? null],
      );
      return true;
    };

    // A caller-supplied transaction gets a savepoint so a failed enqueue cannot abort the appointment write.
    if ('isTransaction' in executor && executor.isTransaction) {
      return await (executor as Knex.Transaction).transaction(async (savepoint) => run(savepoint));
    }
    return await run(executor);
  } catch (error) {
    logWarn('google_calendar_sync_enqueue_failed', {
      account_id: input.accountId,
      reason: input.action,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
}
