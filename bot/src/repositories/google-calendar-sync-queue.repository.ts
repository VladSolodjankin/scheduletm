import { Knex } from 'knex';
import { db } from '../db/knex';
import { logWarn } from '../utils/logger';

type Executor = Knex | Knex.Transaction;

export type CalendarSyncProvider = 'google' | 'microsoft';

export type GoogleCalendarSyncEnqueueInput = {
  accountId: number;
  appointmentId: number;
  action: 'upsert' | 'delete';
  specialistId: number;
  /** Snapshot of an already-created Google event (copied from the appointment row). */
  googleEventId?: string | null;
  webUserId?: number | null;
  /** Snapshot of an already-created Microsoft event (copied from the appointment row). */
  microsoftEventId?: string | null;
  microsoftWebUserId?: number | null;
};

/**
 * Cheap gate. The bot never talks to a calendar provider; it only records the change in the shared outbox
 * (`google_calendar_sync_queue`, one pending row per appointment and provider). The server job re-validates the
 * granted write scope before any provider call, so this gate only avoids writing rows for specialists without
 * a calendar connection.
 */
async function connectedCalendarProviders(
  accountId: number,
  specialistId: number,
  executor: Executor,
): Promise<CalendarSyncProvider[]> {
  const row = await executor('specialists as sp')
    .join('web_user_integrations as wui', function joinIntegrations() {
      this.on('wui.web_user_id', '=', 'sp.user_id').andOn('wui.account_id', '=', 'sp.account_id');
    })
    .where({
      'sp.account_id': accountId,
      'sp.id': specialistId,
    })
    .where(function anyCalendarConnected() {
      this.whereNotNull('wui.google_access_token_encrypted').orWhereNotNull('wui.microsoft_access_token_encrypted');
    })
    .first('wui.google_granted_scopes', 'wui.microsoft_granted_scopes');

  const providers: CalendarSyncProvider[] = [];
  if (row?.google_granted_scopes) {
    providers.push('google');
  }
  if (row?.microsoft_granted_scopes) {
    providers.push('microsoft');
  }
  return providers;
}

type OutboxRow = {
  provider: CalendarSyncProvider;
  googleEventId: string | null;
  externalEventId: string | null;
  webUserId: number | null;
};

/**
 * Same coalescing contract as the server: at most one pending row per (appointment, provider),
 * a delete supersedes everything, a later upsert refreshes an older pending row.
 * Never throws: a failed enqueue must not fail the booking, cancel or reschedule.
 */
export async function enqueueGoogleCalendarSync(
  input: GoogleCalendarSyncEnqueueInput,
  executor: Executor = db,
): Promise<boolean> {
  try {
    const run = async (exec: Executor) => {
      let rows: OutboxRow[] = [];
      if (input.action === 'delete' && input.googleEventId) {
        rows.push({ provider: 'google', googleEventId: input.googleEventId, externalEventId: null, webUserId: input.webUserId ?? null });
      }
      if (input.action === 'delete' && input.microsoftEventId) {
        rows.push({ provider: 'microsoft', googleEventId: null, externalEventId: input.microsoftEventId, webUserId: input.microsoftWebUserId ?? null });
      }
      if (rows.length === 0) {
        const providers = await connectedCalendarProviders(input.accountId, input.specialistId, exec);
        if (providers.length === 0) {
          console.log(
            `[googleCalendarSync][bot] not queued appointment=${input.appointmentId} account=${input.accountId} action=${input.action} skip=no_calendar_connection`,
          );
          return false;
        }
        rows = providers.map((provider) => ({ provider, googleEventId: null, externalEventId: null, webUserId: null }));
      }

      for (const row of rows) {
        await exec.raw(
          `INSERT INTO google_calendar_sync_queue
             (account_id, appointment_id, action, status, google_event_id, web_user_id, provider, external_event_id, attempts, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, 0, now(), now(), now())
           ON CONFLICT (appointment_id, provider) WHERE status = 'pending'
           DO UPDATE SET
             action = CASE WHEN google_calendar_sync_queue.action = 'delete' OR EXCLUDED.action = 'delete' THEN 'delete' ELSE 'upsert' END,
             google_event_id = COALESCE(EXCLUDED.google_event_id, google_calendar_sync_queue.google_event_id),
             external_event_id = COALESCE(EXCLUDED.external_event_id, google_calendar_sync_queue.external_event_id),
             web_user_id = COALESCE(EXCLUDED.web_user_id, google_calendar_sync_queue.web_user_id),
             attempts = 0,
             next_attempt_at = now(),
             updated_at = now()`,
          [input.accountId, input.appointmentId, input.action, row.googleEventId, row.webUserId, row.provider, row.externalEventId],
        );
      }
      console.log(`[googleCalendarSync][bot] queued appointment=${input.appointmentId} action=${input.action}`);
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
