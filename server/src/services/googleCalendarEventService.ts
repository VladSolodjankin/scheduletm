import axios from 'axios';
import {
  findGoogleCalendarSyncAppointment,
  listAppointmentsWithGoogleEvents,
  listAppointmentsWithMicrosoftEvents,
  type CalendarSyncProvider,
  type GoogleCalendarSyncItem,
} from '../repositories/googleCalendarSyncRepository.js';
import {
  buildGoogleEventBody,
  buildGoogleEventId,
  deleteGoogleEvent,
  syncGoogleDelete,
  syncGoogleUpsert,
} from './calendarSync/googleAdapter.js';
import { deleteMicrosoftEvent, syncMicrosoftDelete, syncMicrosoftUpsert } from './calendarSync/microsoftAdapter.js';
import type { CalendarSyncAdapter, SyncOutcome } from './calendarSync/types.js';

/**
 * Provider-neutral calendar sync orchestrator. The queue row names the provider; the matching adapter
 * (calendarSync/googleAdapter.ts, calendarSync/microsoftAdapter.ts) does the provider-specific work.
 * Kept at this path so the Google entry points used by the job and deletion flow stay stable.
 */
export { buildGoogleEventBody, buildGoogleEventId, deleteGoogleEvent };
export type GoogleSyncOutcome = SyncOutcome;

export const GOOGLE_SYNC_MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_CAP_MS = 60 * 60_000;

/** Exponential backoff after the given number of failed attempts (1 -> 1 min, 2 -> 2 min, ... capped at 1 h). */
export function computeGoogleSyncBackoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
}

const adapters: Record<CalendarSyncProvider, CalendarSyncAdapter> = {
  google: {
    upsert: syncGoogleUpsert,
    remove: syncGoogleDelete,
    deleteEvent: ({ accountId, webUserId, eventId }) => deleteGoogleEvent({ accountId, webUserId, googleEventId: eventId }),
  },
  microsoft: {
    upsert: syncMicrosoftUpsert,
    remove: syncMicrosoftDelete,
    deleteEvent: deleteMicrosoftEvent,
  },
};

/** Processes one claimed queue row. Never logs tokens or event content. */
export async function processGoogleCalendarSyncItem(item: GoogleCalendarSyncItem): Promise<SyncOutcome> {
  const provider: CalendarSyncProvider = item.provider ?? 'google';
  try {
    const adapter = adapters[provider];
    if (!adapter) {
      return { kind: 'error', errorStatus: 'unknown_provider', retryable: false };
    }
    const appointment = await findGoogleCalendarSyncAppointment(item.account_id, item.appointment_id);

    if (item.action === 'delete') {
      return await adapter.remove(item, appointment);
    }
    if (!appointment) {
      return { kind: 'done', detail: 'skipped', reason: 'appointment_missing' };
    }
    return await adapter.upsert(item, appointment);
  } catch (error) {
    // Only the error class and code (e.g. Postgres 42703) are logged — never the message, which may carry data.
    const details = error as { name?: string; code?: string };
    console.error(
      `[googleCalendarSync] error appointment=${item.appointment_id} action=${item.action} `
      + `name=${details?.name ?? 'unknown'} code=${details?.code ?? 'none'} account=${item.account_id}`
      + (provider === 'google' ? '' : ` provider=${provider}`),
    );
    return {
      kind: 'error',
      errorStatus: axios.isAxiosError?.(error) ? 'network' : 'internal',
      retryable: true,
    };
  }
}

const DELETION_CLEANUP_LIMIT = 500;

type CleanupFilter = {
  accountId?: number;
  specialistIds?: number[];
  clientId?: number | null;
};

type CleanupTarget = { id: number; account_id: number; webUserId: number; eventId: string };

async function cleanupProvider(
  provider: CalendarSyncProvider,
  filter: CleanupFilter,
  list: () => Promise<CleanupTarget[]>,
): Promise<void> {
  const suffix = provider === 'google' ? '' : ` provider=${provider}`;
  try {
    const all = await list();
    if (all.length > DELETION_CLEANUP_LIMIT) {
      console.error(
        `[googleCalendarSync] deletion cleanup truncated to ${DELETION_CLEANUP_LIMIT} of ${all.length} appointments account=${filter.accountId ?? 'n/a'}${suffix}`,
      );
    }
    for (const appointment of all.slice(0, DELETION_CLEANUP_LIMIT)) {
      try {
        const outcome = await adapters[provider].deleteEvent({
          accountId: appointment.account_id,
          webUserId: appointment.webUserId,
          eventId: appointment.eventId,
        });
        if (outcome.kind === 'error') {
          console.error(
            `[googleCalendarSync] deletion cleanup account=${appointment.account_id} appointment=${appointment.id} status=${outcome.errorStatus}${suffix}`,
          );
        }
      } catch {
        console.error(`[googleCalendarSync] deletion cleanup account=${appointment.account_id} appointment=${appointment.id} status=internal${suffix}`);
      }
    }
  } catch {
    console.error(`[googleCalendarSync] deletion cleanup could not list appointments${suffix}`);
  }
}

/**
 * Best effort: removes Google and Microsoft events of appointments that are about to be hard-deleted (account,
 * user, specialist or client deletion). Never throws and never blocks the deletion; logs only ids and HTTP status.
 */
export async function deleteGoogleEventsBeforeDeletion(filter: CleanupFilter): Promise<void> {
  await cleanupProvider('google', filter, async () =>
    (await listAppointmentsWithGoogleEvents(filter)).map((row) => ({
      id: row.id,
      account_id: row.account_id,
      webUserId: row.google_event_web_user_id,
      eventId: row.google_event_id,
    })));
  await cleanupProvider('microsoft', filter, async () =>
    (await listAppointmentsWithMicrosoftEvents(filter)).map((row) => ({
      id: row.id,
      account_id: row.account_id,
      webUserId: row.microsoft_event_web_user_id,
      eventId: row.microsoft_event_id,
    })));
}
