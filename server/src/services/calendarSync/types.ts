import type { GoogleCalendarSyncAppointment, GoogleCalendarSyncItem } from '../../repositories/googleCalendarSyncRepository.js';

/** Custom namespace GUID for our private extended property that carries the appointment id. */
export const MICROSOFT_APPOINTMENT_PROPERTY_ID = 'String {6c1d4f0e-8a52-4b7d-9e3a-5f21c7b84d10} Name appointmentId';

export type SyncOutcome =
  | { kind: 'done'; detail: 'synced'; event: 'created' | 'updated' | 'deleted' }
  | { kind: 'done'; detail: 'skipped'; reason: string }
  | {
    kind: 'error';
    errorStatus: string;
    retryable: boolean;
    /** Provider-requested minimum delay (Retry-After) used as a floor for the retry backoff. */
    retryAfterMs?: number;
  };

/** One calendar provider's side of the sync pipeline; the orchestrator picks the adapter from the queue row. */
export type CalendarSyncAdapter = {
  upsert(item: GoogleCalendarSyncItem, appointment: GoogleCalendarSyncAppointment): Promise<SyncOutcome>;
  remove(item: GoogleCalendarSyncItem, appointment: GoogleCalendarSyncAppointment | null): Promise<SyncOutcome>;
  /** Deletes one provider event with the owner's credentials (deletion cleanup). */
  deleteEvent(input: { accountId: number; webUserId: number; eventId: string }): Promise<SyncOutcome>;
};

export function isTimeZone(value: string | null): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Parses a Retry-After header (delta-seconds or HTTP date) into milliseconds, capped at one hour. */
export function parseRetryAfterMs(value: unknown, now = Date.now()): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return undefined;
  }
  const text = String(raw).trim();
  if (!text) {
    return undefined;
  }
  const seconds = /^\d+$/.test(text) ? Number(text) : (Date.parse(text) - now) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  return Math.min(Math.ceil(seconds * 1000), 60 * 60_000);
}
