import type { Knex } from 'knex';
import { db } from '../db/knex.js';
import { hasGoogleCalendarWriteScope } from '../utils/googleScopes.js';

export type GoogleCalendarSyncAction = 'upsert' | 'delete';
export type GoogleCalendarSyncStatus = 'pending' | 'processing' | 'done' | 'failed';

export type GoogleCalendarSyncItem = {
  id: number;
  account_id: number;
  appointment_id: number;
  action: GoogleCalendarSyncAction;
  status: GoogleCalendarSyncStatus;
  google_event_id: string | null;
  web_user_id: number | null;
  attempts: number;
  next_attempt_at: Date;
  locked_until: Date | null;
  last_error_status: string | null;
};

export type GoogleCalendarSyncAppointment = {
  id: number;
  account_id: number;
  specialist_id: number;
  appointment_at: Date;
  duration_min: number;
  status: 'new' | 'confirmed' | 'cancelled';
  meeting_link: string | null;
  meeting_provider: string;
  location_address: string | null;
  google_event_id: string | null;
  google_event_web_user_id: number | null;
  specialist_timezone: string | null;
  specialist_user_id: number | null;
  service_name_en: string | null;
  service_name_ru: string | null;
  business_address: string | null;
};

type Executor = Knex | Knex.Transaction;

export type EnqueueGoogleCalendarSyncInput = {
  accountId: number;
  appointmentId: number;
  action: GoogleCalendarSyncAction;
  /** Required for the cheap write-scope gate on upserts. */
  specialistId?: number;
  /** Snapshot of an existing Google event (delete needs it after the appointment row may be gone). */
  googleEventId?: string | null;
  webUserId?: number | null;
};

/** True when the specialist's own web user is connected to Google and granted the calendar write scope. */
export async function isGoogleCalendarWriteAvailableForSpecialist(
  accountId: number,
  specialistId: number,
  executor: Executor = db,
): Promise<boolean> {
  const row = await executor('specialists as s')
    .join('web_user_integrations as wui', function joinIntegrations() {
      this.on('wui.web_user_id', '=', 's.user_id').andOn('wui.account_id', '=', 's.account_id');
    })
    .where({
      's.account_id': accountId,
      's.id': specialistId,
    })
    .whereNotNull('wui.google_access_token_encrypted')
    .first<{ google_granted_scopes: string | null } | undefined>('wui.google_granted_scopes');

  return Boolean(row) && hasGoogleCalendarWriteScope(row?.google_granted_scopes);
}

/** Runs only after the gate said no: names the first failing condition. Diagnostic; never throws. */
async function describeGateSkip(accountId: number, specialistId: number, executor: Executor): Promise<string> {
  try {
    const row = await executor('specialists as s')
      .leftJoin('web_user_integrations as wui', function joinIntegrations() {
        this.on('wui.web_user_id', '=', 's.user_id').andOn('wui.account_id', '=', 's.account_id');
      })
      .where({ 's.account_id': accountId, 's.id': specialistId })
      .first<{ user_id: number | null; web_user_id: number | null; has_token: boolean } | undefined>(
        's.user_id',
        'wui.web_user_id',
        executor.raw('(wui.google_access_token_encrypted IS NOT NULL) as has_token'),
      );
    if (!row) return 'no_specialist';
    if (!row.user_id) return 'specialist_has_no_web_user';
    if (!row.web_user_id) return 'no_integration_row';
    if (!row.has_token) return 'no_access_token';
    return 'write_scope_missing';
  } catch {
    return 'diagnostic_failed';
  }
}

async function insertCoalesced(input: EnqueueGoogleCalendarSyncInput, executor: Executor): Promise<void> {
  // One pending row per appointment: a delete supersedes everything, a later upsert refreshes the older one.
  await executor.raw(
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
}

const KICK_DELAY_MS = 750;
let kickHandler: (() => void) | null = null;

/** Registered by the sync job; lets a successful enqueue trigger a prompt pass instead of waiting for the interval. */
export function setGoogleCalendarSyncKickHandler(handler: (() => void) | null): void {
  kickHandler = handler;
}

/**
 * Delayed so rows enqueued inside a caller's still-open transaction are committed (and visible to the claim
 * query) before the pass runs. Never throws and never blocks the caller.
 */
function scheduleKick(): void {
  if (!kickHandler) {
    return;
  }
  const timer = setTimeout(() => {
    try {
      kickHandler?.();
    } catch {
      // The interval job remains the safety net.
    }
  }, KICK_DELAY_MS);
  timer.unref();
}

/**
 * Cheap, never-throwing enqueue. Gates on the specialist's granted write scope (upserts, and deletes that have no
 * known Google event yet). A caller-supplied transaction is protected with a savepoint so an enqueue
 * failure cannot abort the appointment write.
 */
export async function enqueueGoogleCalendarSync(
  input: EnqueueGoogleCalendarSyncInput,
  executor: Executor = db,
): Promise<boolean> {
  try {
    const hasKnownEvent = input.action === 'delete' && Boolean(input.googleEventId);
    const run = async (exec: Executor): Promise<boolean> => {
      if (!hasKnownEvent) {
        const reason = input.specialistId === undefined
          ? 'no_specialist_id'
          : (await isGoogleCalendarWriteAvailableForSpecialist(input.accountId, input.specialistId, exec))
            ? null
            : await describeGateSkip(input.accountId, input.specialistId, exec);
        if (reason) {
          console.log(
            `[googleCalendarSync] not queued appointment=${input.appointmentId} account=${input.accountId} action=${input.action} skip=${reason}`,
          );
          return false;
        }
      }
      await insertCoalesced(input, exec);
      return true;
    };

    const enqueued = 'isTransaction' in executor && executor.isTransaction
      ? await (executor as Knex.Transaction).transaction(async (savepoint) => run(savepoint))
      : await run(executor);
    if (enqueued) {
      console.log(`[googleCalendarSync] queued appointment=${input.appointmentId} action=${input.action}`);
      scheduleKick();
    }
    return enqueued;
  } catch (error) {
    console.error(
      `[googleCalendarSync] enqueue failed account=${input.accountId} appointment=${input.appointmentId} action=${input.action}: ${
        error instanceof Error ? error.name : 'unknown'
      }`,
    );
    return false;
  }
}

/** Same gate and coalescing as enqueueGoogleCalendarSync, but checks the write scope once for many appointments (series). */
export async function enqueueGoogleCalendarUpserts(
  input: { accountId: number; specialistId: number; appointmentIds: number[] },
  executor: Executor = db,
): Promise<number> {
  if (input.appointmentIds.length === 0) {
    return 0;
  }

  try {
    const run = async (exec: Executor): Promise<number> => {
      if (!(await isGoogleCalendarWriteAvailableForSpecialist(input.accountId, input.specialistId, exec))) {
        const reason = await describeGateSkip(input.accountId, input.specialistId, exec);
        console.log(
          `[googleCalendarSync] not queued appointments=${input.appointmentIds.slice(0, 20).join(',')} account=${input.accountId} action=upsert skip=${reason}`,
        );
        return 0;
      }
      for (const appointmentId of input.appointmentIds) {
        await insertCoalesced({ accountId: input.accountId, appointmentId, action: 'upsert' }, exec);
      }
      return input.appointmentIds.length;
    };

    const count = 'isTransaction' in executor && executor.isTransaction
      ? await (executor as Knex.Transaction).transaction(async (savepoint) => run(savepoint))
      : await run(executor);
    if (count > 0) {
      console.log(`[googleCalendarSync] queued appointments=${input.appointmentIds.slice(0, 20).join(',')} action=upsert`);
      scheduleKick();
    }
    return count;
  } catch (error) {
    console.error(
      `[googleCalendarSync] batch enqueue failed account=${input.accountId}: ${error instanceof Error ? error.name : 'unknown'}`,
    );
    return 0;
  }
}

export async function claimDueGoogleCalendarSyncItems(limit: number, leaseMs: number): Promise<GoogleCalendarSyncItem[]> {
  return db.transaction(async (trx) => {
    const due = await trx('google_calendar_sync_queue as q')
      .where((query) => {
        query
          .where((pending) => pending.where('q.status', 'pending').andWhere('q.next_attempt_at', '<=', trx.fn.now()))
          .orWhere((stale) => stale.where('q.status', 'processing').andWhere('q.locked_until', '<', trx.fn.now()));
      })
      .whereNotExists(function otherInFlight() {
        this.select(trx.raw('1'))
          .from('google_calendar_sync_queue as other')
          .whereRaw('other.appointment_id = q.appointment_id')
          .whereRaw('other.id <> q.id')
          .where('other.status', 'processing')
          .andWhere('other.locked_until', '>=', trx.fn.now());
      })
      .orderBy('q.id', 'asc')
      .limit(limit)
      .forUpdate()
      .skipLocked()
      .select<Array<{ id: number }>>('q.id');

    if (due.length === 0) {
      return [];
    }

    return trx('google_calendar_sync_queue')
      .whereIn('id', due.map((row) => row.id))
      .update({
        status: 'processing',
        locked_until: trx.raw("now() + (? * interval '1 millisecond')", [leaseMs]),
        updated_at: trx.fn.now(),
      })
      .returning<GoogleCalendarSyncItem[]>('*');
  });
}

/**
 * Only the worker that still holds the lease may finish a row: the update is conditional on
 * status='processing' and (when known) the lease value handed out by the claim, so a worker whose
 * lease expired cannot overwrite a row that was re-claimed in the meantime.
 */
function ownedProcessingRow(id: number, lockedUntil?: Date | null) {
  const query = db('google_calendar_sync_queue').where({ id, status: 'processing' });
  if (lockedUntil) {
    // pg returns millisecond precision while the column keeps microseconds.
    query.whereRaw("date_trunc('milliseconds', locked_until) = ?", [lockedUntil]);
  }
  return query;
}

export async function markGoogleCalendarSyncDone(id: number, lockedUntil?: Date | null): Promise<void> {
  await ownedProcessingRow(id, lockedUntil)
    .update({ status: 'done', locked_until: null, updated_at: db.fn.now() });
}

export async function markGoogleCalendarSyncRetry(input: {
  id: number;
  attempts: number;
  nextAttemptAt: Date;
  errorStatus: string;
  lockedUntil?: Date | null;
}): Promise<void> {
  await ownedProcessingRow(input.id, input.lockedUntil)
    .update({
      status: 'pending',
      attempts: input.attempts,
      next_attempt_at: input.nextAttemptAt,
      last_error_status: input.errorStatus,
      locked_until: null,
      updated_at: db.fn.now(),
    });
}

export async function markGoogleCalendarSyncFailed(input: {
  id: number;
  attempts: number;
  errorStatus: string;
  lockedUntil?: Date | null;
}): Promise<void> {
  await ownedProcessingRow(input.id, input.lockedUntil)
    .update({
      status: 'failed',
      attempts: input.attempts,
      last_error_status: input.errorStatus,
      locked_until: null,
      updated_at: db.fn.now(),
    });
}

export async function purgeFinishedGoogleCalendarSyncItems(olderThan: Date): Promise<number> {
  return db('google_calendar_sync_queue')
    .whereIn('status', ['done', 'failed'])
    .andWhere('updated_at', '<', olderThan)
    .delete();
}

export async function findGoogleCalendarSyncAppointment(
  accountId: number,
  appointmentId: number,
): Promise<GoogleCalendarSyncAppointment | null> {
  const row = await db('appointments as a')
    .join('specialists as s', function joinSpecialist() {
      this.on('s.id', '=', 'a.specialist_id').andOn('s.account_id', '=', 'a.account_id');
    })
    .leftJoin('web_users as wu', function joinSpecialistUser() {
      this.on('wu.id', '=', 's.user_id').andOn('wu.account_id', '=', 's.account_id');
    })
    .leftJoin('services as sv', function joinService() {
      this.on('sv.id', '=', 'a.service_id').andOn('sv.account_id', '=', 'a.account_id');
    })
    .leftJoin('account_settings as aset', 'aset.account_id', 'a.account_id')
    .where({ 'a.account_id': accountId, 'a.id': appointmentId })
    .first(
      'a.id', 'a.account_id', 'a.specialist_id', 'a.appointment_at', 'a.duration_min', 'a.status',
      'a.meeting_link', 'a.meeting_provider', 'a.location_address',
      'a.google_event_id', 'a.google_event_web_user_id',
      db.raw("COALESCE(wu.timezone, 'UTC') as specialist_timezone"),
      's.user_id as specialist_user_id',
      'sv.name_en as service_name_en', 'sv.name_ru as service_name_ru',
      'aset.business_address',
    );

  return (row as GoogleCalendarSyncAppointment | undefined) ?? null;
}

export async function setAppointmentGoogleEvent(input: {
  accountId: number;
  appointmentId: number;
  googleEventId: string | null;
  webUserId: number | null;
}): Promise<void> {
  await db('appointments')
    .where({ account_id: input.accountId, id: input.appointmentId })
    .update({
      google_event_id: input.googleEventId,
      google_event_web_user_id: input.webUserId,
    });
}

/** Appointments that currently own a Google event, used to clean calendars before hard deletion. */
export async function listAppointmentsWithGoogleEvents(filter: {
  accountId?: number;
  specialistIds?: number[];
  clientId?: number | null;
}): Promise<Array<{ id: number; account_id: number; google_event_id: string; google_event_web_user_id: number }>> {
  const query = db('appointments')
    .whereNotNull('google_event_id')
    .whereNotNull('google_event_web_user_id');

  if (filter.accountId !== undefined) {
    query.where({ account_id: filter.accountId });
  }
  if (filter.specialistIds) {
    query.whereIn('specialist_id', filter.specialistIds);
  }
  if (filter.clientId) {
    query.where({ user_id: filter.clientId });
  }

  return query.select('id', 'account_id', 'google_event_id', 'google_event_web_user_id');
}
