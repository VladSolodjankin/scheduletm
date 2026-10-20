import axios from 'axios';
import {
  findGoogleCalendarSyncAppointment,
  listAppointmentsWithGoogleEvents,
  setAppointmentGoogleEvent,
  type GoogleCalendarSyncAppointment,
  type GoogleCalendarSyncItem,
} from '../repositories/googleCalendarSyncRepository.js';
import { findWebUserIntegrationByWebUserId } from '../repositories/webUserIntegrationRepository.js';
import { hasGoogleCalendarWriteScope } from '../utils/googleScopes.js';
import { resolveUsableGoogleAccessToken } from './calendarAvailabilityService.js';

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const REQUEST_TIMEOUT_MS = 10_000;

export const GOOGLE_SYNC_MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_CAP_MS = 60 * 60_000;

/** Exponential backoff after the given number of failed attempts (1 -> 1 min, 2 -> 2 min, ... capped at 1 h). */
export function computeGoogleSyncBackoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
}

export type GoogleSyncOutcome =
  | { kind: 'done'; detail: 'synced' | 'skipped' }
  | { kind: 'error'; errorStatus: string; retryable: boolean };

type WriteCredentials = {
  accountId: number;
  webUserId: number;
  googleApiKey: string;
  googleRefreshToken: string | null;
  googleTokenExpiresAt: Date | null;
};

type GoogleResponse = { status: number; data: { id?: unknown } | undefined };

/** The granted write scope is re-validated at processing time; null means Google must not be called. */
async function loadWriteCredentials(accountId: number, webUserId: number): Promise<WriteCredentials | null> {
  const integration = await findWebUserIntegrationByWebUserId(accountId, webUserId);
  if (
    !integration
    || !integration.google_api_key
    || !hasGoogleCalendarWriteScope(integration.google_granted_scopes)
  ) {
    return null;
  }

  return {
    accountId,
    webUserId,
    googleApiKey: integration.google_api_key,
    googleRefreshToken: integration.google_refresh_token,
    googleTokenExpiresAt: integration.google_token_expires_at,
  };
}

async function send(
  credentials: WriteCredentials,
  method: 'POST' | 'PATCH' | 'DELETE',
  eventId: string | null,
  body: unknown,
): Promise<GoogleResponse | { authError: 'no_refresh_token' | 'refresh_failed' }> {
  const url = eventId ? `${GOOGLE_EVENTS_URL}/${encodeURIComponent(eventId)}` : GOOGLE_EVENTS_URL;

  const attempt = async (forceRefresh: boolean) => {
    const token = await resolveUsableGoogleAccessToken({ ...credentials, forceRefresh });
    if (!token.ok) {
      return { authError: token.reason } as const;
    }
    const response = await axios.request<{ id?: unknown }>({
      method,
      url,
      params: { sendUpdates: 'none' },
      data: method === 'DELETE' ? undefined : body,
      headers: { Authorization: `Bearer ${token.accessToken}` },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    return { status: response.status, data: response.data } as GoogleResponse;
  };

  const first = await attempt(false);
  if ('authError' in first || first.status !== 401) {
    return first;
  }
  // Access token rejected: refresh once and retry.
  return attempt(true);
}

function toError(result: GoogleResponse | { authError: string }): GoogleSyncOutcome {
  if ('authError' in result) {
    return { kind: 'error', errorStatus: result.authError, retryable: true };
  }
  const { status } = result;
  const retryable = status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
  return { kind: 'error', errorStatus: String(status), retryable };
}

function isTimeZone(value: string | null): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Privacy-minimised event: service name, time, address and meeting link only.
 * Never includes client name, phone, email, notes or Telegram username; no attendees.
 */
export function buildGoogleEventBody(appointment: GoogleCalendarSyncAppointment) {
  const start = new Date(appointment.appointment_at);
  const end = new Date(start.getTime() + appointment.duration_min * 60_000);
  const timeZone = isTimeZone(appointment.specialist_timezone) ? appointment.specialist_timezone : 'UTC';
  const location = appointment.location_address?.trim()
    || (appointment.meeting_provider === 'offline' ? appointment.business_address?.trim() : '')
    || undefined;
  const meetingLink = appointment.meeting_link?.trim();

  return {
    summary: appointment.service_name_en?.trim() || appointment.service_name_ru?.trim() || 'Appointment',
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    ...(location ? { location } : {}),
    ...(meetingLink ? { description: meetingLink } : {}),
    extendedProperties: { private: { appointmentId: String(appointment.id) } },
  };
}

/** Deletes one Google event with the owner's credentials; 404/410 count as success. */
export async function deleteGoogleEvent(input: {
  accountId: number;
  webUserId: number;
  googleEventId: string;
}): Promise<GoogleSyncOutcome> {
  const credentials = await loadWriteCredentials(input.accountId, input.webUserId);
  if (!credentials) {
    return { kind: 'done', detail: 'skipped' };
  }

  let result: Awaited<ReturnType<typeof send>>;
  try {
    result = await send(credentials, 'DELETE', input.googleEventId, undefined);
  } catch {
    return { kind: 'error', errorStatus: 'network', retryable: true };
  }

  if (!('authError' in result) && (result.status < 300 || result.status === 404 || result.status === 410)) {
    return { kind: 'done', detail: 'synced' };
  }
  return toError(result);
}

async function clearEventReference(accountId: number, appointmentId: number): Promise<void> {
  await setAppointmentGoogleEvent({ accountId, appointmentId, googleEventId: null, webUserId: null });
}

const GOOGLE_EVENT_ID_PATTERN = /^sm([0-9a-v]{12})([0-9a-v]{12})([0-9a-v]*)$/;

/**
 * Deterministic client-chosen event id (Google allows a-v and 0-9, 5-1024 chars), so a retry after a
 * lost id write hits 409 instead of creating a duplicate. `generation` > 0 is used when an earlier id
 * was deleted in Google (a deleted id cannot be re-inserted).
 */
export function buildGoogleEventId(accountId: number, appointmentId: number, generation = 0): string {
  const part = (value: number) => value.toString(32).padStart(12, '0');
  return `sm${part(accountId)}${part(appointmentId)}${generation > 0 ? generation.toString(32) : ''}`;
}

function nextGenerationAfter(previousEventId: string | null): number {
  const match = previousEventId ? GOOGLE_EVENT_ID_PATTERN.exec(previousEventId) : null;
  if (!match) {
    return previousEventId ? 1 : 0;
  }
  return (match[3] ? parseInt(match[3], 32) : 0) + 1;
}

async function storeEventId(
  appointment: GoogleCalendarSyncAppointment,
  credentials: WriteCredentials,
  googleEventId: string,
): Promise<GoogleSyncOutcome> {
  await setAppointmentGoogleEvent({
    accountId: appointment.account_id,
    appointmentId: appointment.id,
    googleEventId,
    webUserId: credentials.webUserId,
  });
  return { kind: 'done', detail: 'synced' };
}

async function createEvent(
  appointment: GoogleCalendarSyncAppointment,
  credentials: WriteCredentials,
  previousEventId: string | null = null,
): Promise<GoogleSyncOutcome> {
  const eventId = buildGoogleEventId(appointment.account_id, appointment.id, nextGenerationAfter(previousEventId));
  const body = buildGoogleEventBody(appointment);
  const result = await send(credentials, 'POST', null, { ...body, id: eventId });

  if (!('authError' in result) && result.status === 409) {
    // Already inserted by an earlier attempt whose id write was lost: update it instead of duplicating.
    const patched = await send(credentials, 'PATCH', eventId, { ...body, status: 'confirmed' });
    if ('authError' in patched || patched.status >= 300) {
      return toError(patched);
    }
    return storeEventId(appointment, credentials, eventId);
  }
  if ('authError' in result || result.status >= 300) {
    return toError(result);
  }

  const createdId = typeof result.data?.id === 'string' ? result.data.id : eventId;
  return storeEventId(appointment, credentials, createdId);
}

async function syncDelete(item: GoogleCalendarSyncItem, appointment: GoogleCalendarSyncAppointment | null): Promise<GoogleSyncOutcome> {
  const googleEventId = appointment?.google_event_id ?? item.google_event_id;
  const webUserId = appointment?.google_event_web_user_id ?? item.web_user_id;
  if (!googleEventId || !webUserId) {
    return { kind: 'done', detail: 'skipped' };
  }

  const outcome = await deleteGoogleEvent({ accountId: item.account_id, webUserId, googleEventId });
  if (outcome.kind === 'done' && appointment) {
    await clearEventReference(item.account_id, item.appointment_id);
  }
  return outcome;
}

async function syncUpsert(item: GoogleCalendarSyncItem, appointment: GoogleCalendarSyncAppointment): Promise<GoogleSyncOutcome> {
  if (appointment.status === 'cancelled') {
    return syncDelete(item, appointment);
  }

  const targetWebUserId = appointment.specialist_user_id;
  if (!targetWebUserId) {
    return { kind: 'done', detail: 'skipped' };
  }

  let existingEventId = appointment.google_event_id;
  if (existingEventId && appointment.google_event_web_user_id && appointment.google_event_web_user_id !== targetWebUserId) {
    // The specialist changed: remove the event from the previous owner's calendar first.
    const removed = await deleteGoogleEvent({
      accountId: item.account_id,
      webUserId: appointment.google_event_web_user_id,
      googleEventId: existingEventId,
    });
    if (removed.kind === 'error') {
      return removed;
    }
    await clearEventReference(item.account_id, item.appointment_id);
    existingEventId = null;
  }

  const credentials = await loadWriteCredentials(item.account_id, targetWebUserId);
  if (!credentials) {
    return { kind: 'done', detail: 'skipped' };
  }

  if (!existingEventId) {
    return createEvent(appointment, credentials);
  }

  const result = await send(credentials, 'PATCH', existingEventId, buildGoogleEventBody(appointment));
  if (!('authError' in result) && result.status < 300) {
    return { kind: 'done', detail: 'synced' };
  }
  if (!('authError' in result) && (result.status === 404 || result.status === 410)) {
    // Event was removed in Google; recreate it.
    return createEvent(appointment, credentials, existingEventId);
  }
  return toError(result);
}

/** Processes one claimed queue row. Never logs tokens or event content. */
export async function processGoogleCalendarSyncItem(item: GoogleCalendarSyncItem): Promise<GoogleSyncOutcome> {
  try {
    const appointment = await findGoogleCalendarSyncAppointment(item.account_id, item.appointment_id);

    if (item.action === 'delete') {
      return await syncDelete(item, appointment);
    }
    if (!appointment) {
      return { kind: 'done', detail: 'skipped' };
    }
    return await syncUpsert(item, appointment);
  } catch (error) {
    return {
      kind: 'error',
      errorStatus: axios.isAxiosError?.(error) ? 'network' : 'internal',
      retryable: true,
    };
  }
}

const DELETION_CLEANUP_LIMIT = 500;

/**
 * Best effort: removes Google events of appointments that are about to be hard-deleted (account, user,
 * specialist or client deletion). Never throws and never blocks the deletion; logs only ids and HTTP status.
 */
export async function deleteGoogleEventsBeforeDeletion(filter: {
  accountId?: number;
  specialistIds?: number[];
  clientId?: number | null;
}): Promise<void> {
  try {
    const all = await listAppointmentsWithGoogleEvents(filter);
    if (all.length > DELETION_CLEANUP_LIMIT) {
      console.error(
        `[googleCalendarSync] deletion cleanup truncated to ${DELETION_CLEANUP_LIMIT} of ${all.length} appointments account=${filter.accountId ?? 'n/a'}`,
      );
    }
    const appointments = all.slice(0, DELETION_CLEANUP_LIMIT);
    for (const appointment of appointments) {
      try {
        const outcome = await deleteGoogleEvent({
          accountId: appointment.account_id,
          webUserId: appointment.google_event_web_user_id,
          googleEventId: appointment.google_event_id,
        });
        if (outcome.kind === 'error') {
          console.error(
            `[googleCalendarSync] deletion cleanup account=${appointment.account_id} appointment=${appointment.id} status=${outcome.errorStatus}`,
          );
        }
      } catch {
        console.error(`[googleCalendarSync] deletion cleanup account=${appointment.account_id} appointment=${appointment.id} status=internal`);
      }
    }
  } catch {
    console.error('[googleCalendarSync] deletion cleanup could not list appointments');
  }
}
