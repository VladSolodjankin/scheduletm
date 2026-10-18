import axios from 'axios';
import { findSpecialistsCalendarCredentials } from '../repositories/specialistRepository.js';
import { refreshGoogleAccessToken } from './googleOAuthService.js';

export type ExternalBusySlot = {
  specialistId: number;
  scheduledAt: string;
  durationMin: number;
  source: 'google';
};

type GoogleFreeBusyResponse = {
  calendars?: Record<string, {
    busy?: Array<{ start?: string; end?: string }>;
    errors?: Array<{ domain?: string; reason?: string }>;
  }>;
};

const GOOGLE_FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const GOOGLE_FREEBUSY_CALENDAR_ID = 'primary';

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

export async function listExternalBusySlots(input: {
  accountId: number;
  specialistIds: number[];
  from: Date;
  to: Date;
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
      const googleApiKey = token.accessToken;

      try {
        const response = await axios.post<GoogleFreeBusyResponse>(
          GOOGLE_FREEBUSY_URL,
          {
            timeMin: input.from.toISOString(),
            timeMax: input.to.toISOString(),
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
    }),
  );

  return busySlots.flat();
}
