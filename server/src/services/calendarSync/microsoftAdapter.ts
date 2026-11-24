import axios from 'axios';
import { createHash } from 'node:crypto';
import {
  setAppointmentMicrosoftEvent,
  type GoogleCalendarSyncAppointment,
  type GoogleCalendarSyncItem,
} from '../../repositories/googleCalendarSyncRepository.js';
import { findWebUserIntegrationByWebUserId } from '../../repositories/webUserIntegrationRepository.js';
import { hasMicrosoftCalendarWriteScope } from '../../utils/microsoftScopes.js';
import { resolveUsableMicrosoftAccessToken } from '../microsoftOAuthService.js';
import { MICROSOFT_APPOINTMENT_PROPERTY_ID, parseRetryAfterMs, type SyncOutcome } from './types.js';

export { MICROSOFT_APPOINTMENT_PROPERTY_ID };

const GRAPH_EVENTS_URL = 'https://graph.microsoft.com/v1.0/me/events';
const REQUEST_TIMEOUT_MS = 10_000;

type WriteCredentials = {
  accountId: number;
  webUserId: number;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
};

type GraphResponse = { status: number; data: { id?: unknown } | undefined; headers?: Record<string, unknown> };
type AuthError = { authError: 'no_refresh_token' | 'refresh_failed' | 'invalid_grant' };

/** The granted write scope is re-validated at processing time; a skip reason means Graph must not be called. */
async function loadWriteCredentials(
  accountId: number,
  webUserId: number,
): Promise<WriteCredentials | { skipReason: string }> {
  const integration = await findWebUserIntegrationByWebUserId(accountId, webUserId);
  if (!integration) {
    return { skipReason: 'no_integration_row' };
  }
  if (!integration.microsoft_access_token && !integration.microsoft_refresh_token) {
    return { skipReason: 'no_access_token' };
  }
  if (!hasMicrosoftCalendarWriteScope(integration.microsoft_granted_scopes)) {
    return { skipReason: 'write_scope_missing' };
  }

  return {
    accountId,
    webUserId,
    accessToken: integration.microsoft_access_token,
    refreshToken: integration.microsoft_refresh_token,
    expiresAt: integration.microsoft_token_expires_at,
  };
}

async function send(
  credentials: WriteCredentials,
  method: 'POST' | 'PATCH' | 'DELETE',
  eventId: string | null,
  body: unknown,
): Promise<GraphResponse | AuthError> {
  const url = eventId ? `${GRAPH_EVENTS_URL}/${encodeURIComponent(eventId)}` : GRAPH_EVENTS_URL;

  const attempt = async (forceRefresh: boolean): Promise<GraphResponse | AuthError> => {
    const token = await resolveUsableMicrosoftAccessToken({ ...credentials, forceRefresh });
    if (!token.ok) {
      return { authError: token.reason };
    }
    const response = await axios.request<{ id?: unknown }>({
      method,
      url,
      data: method === 'DELETE' ? undefined : body,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        // Stable ids that survive the event being moved between folders.
        Prefer: 'IdType="ImmutableId"',
      },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    return { status: response.status, data: response.data, headers: response.headers as Record<string, unknown> | undefined };
  };

  const first = await attempt(false);
  if ('authError' in first || first.status !== 401) {
    return first;
  }
  // Access token rejected: refresh once and retry.
  return attempt(true);
}

function toError(result: GraphResponse | AuthError): SyncOutcome {
  if ('authError' in result) {
    // invalid_grant: the refresh token was revoked/expired; retrying cannot succeed until the user reconnects.
    return { kind: 'error', errorStatus: result.authError, retryable: result.authError !== 'invalid_grant' };
  }
  const { status } = result;
  // 403 (ErrorAccessDenied) is a permission problem, not transient.
  const retryable = status === 401 || status === 408 || status === 429 || status >= 500;
  const retryAfterMs = status === 429 || status === 503 || status === 504
    ? parseRetryAfterMs(result.headers?.['retry-after'])
    : undefined;
  return {
    kind: 'error',
    errorStatus: String(status),
    retryable,
    ...(retryAfterMs ? { retryAfterMs } : {}),
  };
}

function toGraphDateTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/**
 * Privacy-minimised event: service name, time (UTC), location and meeting link only.
 * Never includes client name, phone, email, notes or Telegram username; no attendees.
 * On update, absent location/link are sent empty so removed values are cleared in Outlook.
 */
export function buildMicrosoftEventBody(appointment: GoogleCalendarSyncAppointment, forUpdate = false) {
  const start = new Date(appointment.appointment_at);
  const end = new Date(start.getTime() + appointment.duration_min * 60_000);
  const location = appointment.location_address?.trim()
    || (appointment.meeting_provider === 'offline' ? appointment.business_address?.trim() : '')
    || '';
  const meetingLink = appointment.meeting_link?.trim() ?? '';

  return {
    subject: appointment.service_name_en?.trim() || appointment.service_name_ru?.trim() || 'Appointment',
    start: { dateTime: toGraphDateTime(start), timeZone: 'UTC' },
    end: { dateTime: toGraphDateTime(end), timeZone: 'UTC' },
    showAs: 'busy',
    ...(location || forUpdate ? { location: { displayName: location } } : {}),
    ...(meetingLink || forUpdate ? { body: { contentType: 'text', content: meetingLink } } : {}),
    singleValueExtendedProperties: [{ id: MICROSOFT_APPOINTMENT_PROPERTY_ID, value: String(appointment.id) }],
  };
}

/**
 * Idempotency key for POST: stable per (account, appointment, previously deleted event) so a retry after a lost
 * id write cannot duplicate the event, while a recreate after the event vanished in Outlook gets a fresh key.
 */
export function buildMicrosoftTransactionId(accountId: number, appointmentId: number, previousEventId: string | null = null): string {
  const base = `sm-${accountId}-${appointmentId}`;
  return previousEventId
    ? `${base}-${createHash('sha256').update(previousEventId).digest('hex').slice(0, 12)}`
    : base;
}

/** Deletes one Outlook event with the owner's credentials; 404 counts as success. */
export async function deleteMicrosoftEvent(input: {
  accountId: number;
  webUserId: number;
  eventId: string;
}): Promise<SyncOutcome> {
  const credentials = await loadWriteCredentials(input.accountId, input.webUserId);
  if ('skipReason' in credentials) {
    return { kind: 'done', detail: 'skipped', reason: credentials.skipReason };
  }

  let result: Awaited<ReturnType<typeof send>>;
  try {
    result = await send(credentials, 'DELETE', input.eventId, undefined);
  } catch {
    return { kind: 'error', errorStatus: 'network', retryable: true };
  }

  if (!('authError' in result) && (result.status < 300 || result.status === 404 || result.status === 410)) {
    return { kind: 'done', detail: 'synced', event: 'deleted' };
  }
  return toError(result);
}

async function clearEventReference(accountId: number, appointmentId: number): Promise<void> {
  await setAppointmentMicrosoftEvent({ accountId, appointmentId, microsoftEventId: null, webUserId: null });
}

async function createEvent(
  appointment: GoogleCalendarSyncAppointment,
  credentials: WriteCredentials,
  previousEventId: string | null = null,
): Promise<SyncOutcome> {
  const body = {
    ...buildMicrosoftEventBody(appointment),
    transactionId: buildMicrosoftTransactionId(appointment.account_id, appointment.id, previousEventId),
  };
  let result = await send(credentials, 'POST', null, body);
  if (!('authError' in result) && result.status === 409) {
    // Graph may keep the transactionId of an event that was deleted earlier (cancel then restore); retry once with a fresh key.
    result = await send(credentials, 'POST', null, {
      ...body,
      transactionId: `${body.transactionId}-r${Date.now().toString(36)}`,
    });
  }
  if ('authError' in result || result.status >= 300) {
    return toError(result);
  }

  const createdId = result.data?.id;
  if (typeof createdId !== 'string' || !createdId) {
    return { kind: 'error', errorStatus: 'no_event_id', retryable: true };
  }
  await setAppointmentMicrosoftEvent({
    accountId: appointment.account_id,
    appointmentId: appointment.id,
    microsoftEventId: createdId,
    webUserId: credentials.webUserId,
  });
  return { kind: 'done', detail: 'synced', event: 'created' };
}

export async function syncMicrosoftDelete(
  item: GoogleCalendarSyncItem,
  appointment: GoogleCalendarSyncAppointment | null,
): Promise<SyncOutcome> {
  const eventId = appointment?.microsoft_event_id ?? item.external_event_id ?? null;
  const webUserId = appointment?.microsoft_event_web_user_id ?? item.web_user_id;
  if (!eventId || !webUserId) {
    return { kind: 'done', detail: 'skipped', reason: 'no_event_reference' };
  }

  const outcome = await deleteMicrosoftEvent({ accountId: item.account_id, webUserId, eventId });
  if (outcome.kind === 'done' && outcome.detail === 'synced' && appointment) {
    await clearEventReference(item.account_id, item.appointment_id);
  }
  return outcome;
}

export async function syncMicrosoftUpsert(
  item: GoogleCalendarSyncItem,
  appointment: GoogleCalendarSyncAppointment,
): Promise<SyncOutcome> {
  if (appointment.status === 'cancelled') {
    return syncMicrosoftDelete(item, appointment);
  }

  const targetWebUserId = appointment.specialist_user_id;
  if (!targetWebUserId) {
    return { kind: 'done', detail: 'skipped', reason: 'specialist_has_no_web_user' };
  }

  let existingEventId = appointment.microsoft_event_id ?? null;
  const previousOwner = appointment.microsoft_event_web_user_id ?? null;
  if (existingEventId && previousOwner && previousOwner !== targetWebUserId) {
    // The specialist changed: remove the event from the previous owner's calendar first.
    const removed = await deleteMicrosoftEvent({
      accountId: item.account_id,
      webUserId: previousOwner,
      eventId: existingEventId,
    });
    if (removed.kind === 'error') {
      return removed;
    }
    await clearEventReference(item.account_id, item.appointment_id);
    existingEventId = null;
  }

  const credentials = await loadWriteCredentials(item.account_id, targetWebUserId);
  if ('skipReason' in credentials) {
    return { kind: 'done', detail: 'skipped', reason: credentials.skipReason };
  }

  if (!existingEventId) {
    return createEvent(appointment, credentials);
  }

  const result = await send(credentials, 'PATCH', existingEventId, buildMicrosoftEventBody(appointment, true));
  if (!('authError' in result) && result.status < 300) {
    return { kind: 'done', detail: 'synced', event: 'updated' };
  }
  if (!('authError' in result) && (result.status === 404 || result.status === 410)) {
    // Event was removed in Outlook; recreate it under a fresh idempotency key.
    return createEvent(appointment, credentials, existingEventId);
  }
  return toError(result);
}
