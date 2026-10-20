import axios from 'axios';
import { findSpecialistsCalendarCredentials } from '../repositories/specialistRepository.js';
import { refreshGoogleAccessToken } from './googleOAuthService.js';

export type ExternalBusySlot = {
  specialistId: number;
  scheduledAt: string;
  durationMin: number;
  source: 'google';
  /** Present only for the Google account owner viewing their own appointments calendar. */
  title?: string;
};

type GoogleEventsListResponse = {
  nextPageToken?: string;
  items?: Array<{
    status?: string;
    transparency?: string;
    summary?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
    attendees?: Array<{ self?: boolean; responseStatus?: string }>;
    extendedProperties?: { private?: Record<string, string> };
  }>;
};

type GoogleFreeBusyResponse = {
  calendars?: Record<string, {
    busy?: Array<{ start?: string; end?: string }>;
    errors?: Array<{ domain?: string; reason?: string }>;
  }>;
};

const GOOGLE_FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const GOOGLE_FREEBUSY_CALENDAR_ID = 'primary';
const GOOGLE_EVENTS_LIST_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const EVENTS_LIST_MAX_PAGES = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

function isAccessTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return true;
  }

  const safetyWindowMs = 30 * 1000;
  return expiresAt.getTime() <= Date.now() + safetyWindowMs;
}

export type UsableGoogleAccessToken =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'no_refresh_token' | 'refresh_failed' };

/**
 * Returns a non-expired Google access token for the web user, refreshing (and persisting) it when needed.
 * `forceRefresh` is used after a 401 from Google. Tokens are never logged.
 */
export async function resolveUsableGoogleAccessToken(input: {
  accountId: number;
  webUserId: number;
  googleApiKey: string;
  googleRefreshToken: string | null;
  googleTokenExpiresAt: Date | null;
  forceRefresh?: boolean;
}): Promise<UsableGoogleAccessToken> {
  if (!input.forceRefresh && !isAccessTokenExpired(input.googleTokenExpiresAt)) {
    return { ok: true, accessToken: input.googleApiKey };
  }

  if (!input.googleRefreshToken) {
    return { ok: false, reason: 'no_refresh_token' };
  }

  const refreshed = await refreshGoogleAccessToken({
    accountId: input.accountId,
    webUserId: input.webUserId,
    refreshToken: input.googleRefreshToken,
  });

  return refreshed
    ? { ok: true, accessToken: refreshed.googleApiKey }
    : { ok: false, reason: 'refresh_failed' };
}

function toDurationMin(startIso?: string, endIso?: string): number | null {
  if (!startIso || !endIso) {
    return null;
  }

  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const durationMin = Math.round((end - start) / (60 * 1000));

  if (durationMin <= 0) {
    return null;
  }

  return durationMin;
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function timeZoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Midnight of a YYYY-MM-DD calendar date in the given IANA time zone, as epoch ms (null when invalid). */
function startOfDateInTimeZone(date: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  const wallClockUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const first = wallClockUtc - timeZoneOffsetMs(wallClockUtc, zone);
  return wallClockUtc - timeZoneOffsetMs(first, zone);
}

function resolveEventBoundary(
  value: { date?: string; dateTime?: string } | undefined,
  timeZone: string,
): number | null {
  if (value?.dateTime) {
    const ms = new Date(value.dateTime).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (value?.date) {
    return startOfDateInTimeZone(value.date, timeZone);
  }
  return null;
}

type SpecialistCredentialsItem = Awaited<ReturnType<typeof findSpecialistsCalendarCredentials>>[number];

/**
 * Live events.list for the Google account owner's own appointments calendar. Titles are returned to the
 * caller only and are never cached, stored or logged. Returns null when the request fails.
 */
async function fetchOwnerEventSlots(
  item: SpecialistCredentialsItem,
  accessToken: string,
  from: Date,
  to: Date,
): Promise<ExternalBusySlot[] | null> {
  const slots: ExternalBusySlot[] = [];

  try {
    let pageToken: string | undefined;
    for (let page = 0; page < EVENTS_LIST_MAX_PAGES; page += 1) {
      const response = await axios.get<GoogleEventsListResponse>(GOOGLE_EVENTS_LIST_URL, {
        params: {
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: true,
          showDeleted: false,
          maxResults: 250,
          fields: 'nextPageToken,items(status,transparency,summary,start,end,attendees(self,responseStatus),extendedProperties/private)',
          ...(pageToken ? { pageToken } : {}),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10_000,
      });

      for (const event of response.data.items ?? []) {
        if (
          event.status === 'cancelled'
          || event.transparency === 'transparent'
          || event.extendedProperties?.private?.appointmentId !== undefined
          || event.attendees?.some((attendee) => attendee.self && attendee.responseStatus === 'declined')
        ) {
          continue;
        }

        const startMs = resolveEventBoundary(event.start, item.timezone);
        if (startMs === null) {
          continue;
        }
        let endMs = resolveEventBoundary(event.end, item.timezone);
        if ((endMs === null || endMs <= startMs) && event.start?.date) {
          endMs = startMs + DAY_MS;
        }
        const durationMin = endMs === null ? 0 : Math.round((endMs - startMs) / 60_000);
        if (durationMin <= 0) {
          continue;
        }

        const title = event.summary?.trim();
        slots.push({
          specialistId: item.specialistId,
          scheduledAt: new Date(startMs).toISOString(),
          durationMin,
          source: 'google',
          ...(title ? { title } : {}),
        });
      }

      pageToken = response.data.nextPageToken;
      if (!pageToken) {
        return slots;
      }
    }
    console.warn(
      `[calendarAvailability] specialist ${item.specialistId}: events.list exceeded page cap, falling back to generic busy blocks`,
    );
    return null;
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? (error.response?.status ?? 'network') : 'internal';
    console.error(
      `[calendarAvailability] specialist ${item.specialistId}: events.list failed (status ${status}), falling back to generic busy blocks`,
    );
    return null;
  }
}

async function fetchFreeBusySlots(
  item: SpecialistCredentialsItem,
  googleApiKey: string,
  from: Date,
  to: Date,
): Promise<ExternalBusySlot[]> {
  try {
    const response = await axios.post<GoogleFreeBusyResponse>(
      GOOGLE_FREEBUSY_URL,
      {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: GOOGLE_FREEBUSY_CALENDAR_ID }],
      },
      {
        headers: {
          Authorization: `Bearer ${googleApiKey}`,
        },
      },
    );

    const calendars = response.data.calendars ?? {};
    const calendarKeys = Object.keys(calendars);
    // Google may key the primary calendar by its address; accept a single unambiguous entry.
    const calendar = calendars[GOOGLE_FREEBUSY_CALENDAR_ID]
      ?? (calendarKeys.length === 1 ? calendars[calendarKeys[0]] : undefined);
    if (!calendar) {
      console.error(
        `[calendarAvailability] specialist ${item.specialistId}: freeBusy response had no usable calendar entry, skipping their Google calendar`,
      );
      return [];
    }
    if (calendar.errors?.length) {
      console.error(
        `[calendarAvailability] specialist ${item.specialistId}: freeBusy returned calendar errors (${calendar.errors.map((e) => e.reason).join(',')}), skipping their Google calendar`,
      );
      return [];
    }

    return (calendar.busy ?? [])
      .map((interval) => {
        const durationMin = toDurationMin(interval.start, interval.end);
        if (!durationMin || !interval.start) {
          return null;
        }

        return {
          specialistId: item.specialistId,
          scheduledAt: new Date(interval.start).toISOString(),
          durationMin,
          source: 'google' as const,
        };
      })
      .filter((slot): slot is ExternalBusySlot => Boolean(slot));
  } catch (error: unknown) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message ?? error.message
      : error instanceof Error
        ? error.message
        : String(error);
    console.error(
      `[calendarAvailability] specialist ${item.specialistId}: failed to fetch freeBusy, skipping their Google calendar: ${message}`,
    );
    return [];
  }
}

/**
 * External busy slots. freeBusy is used for everyone (correct slot-blocking semantics). Only when
 * `ownerWebUserId` equals the web user who owns a specialist's Google account is events.list used instead,
 * to show that owner their own event titles; it falls back to freeBusy (no titles) if events.list fails.
 */
export async function listExternalBusySlots(input: {
  accountId: number;
  specialistIds: number[];
  from: Date;
  to: Date;
  ownerWebUserId?: number;
}): Promise<ExternalBusySlot[]> {
  const credentials = await findSpecialistsCalendarCredentials(input.accountId, input.specialistIds);

  if (!credentials.length) {
    return [];
  }

  const busySlots = await Promise.all(
    credentials.map(async (item) => {
      const token = await resolveUsableGoogleAccessToken({
        accountId: input.accountId,
        webUserId: item.webUserId,
        googleApiKey: item.googleApiKey,
        googleRefreshToken: item.googleRefreshToken,
        googleTokenExpiresAt: item.googleTokenExpiresAt,
      });

      if (!token.ok) {
        console.error(
          token.reason === 'no_refresh_token'
            ? `[calendarAvailability] specialist ${item.specialistId}: Google access token expired and no refresh token on file, skipping their Google calendar`
            : `[calendarAvailability] specialist ${item.specialistId}: Google token refresh failed, likely revoked access — skipping their Google calendar until they reconnect`,
        );
        return [];
      }

      if (input.ownerWebUserId !== undefined && input.ownerWebUserId === item.webUserId) {
        const ownerSlots = await fetchOwnerEventSlots(item, token.accessToken, input.from, input.to);
        if (ownerSlots) {
          return ownerSlots;
        }
      }

      return fetchFreeBusySlots(item, token.accessToken, input.from, input.to);
    }),
  );

  return busySlots.flat();
}
