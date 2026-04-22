import axios from 'axios';
import { findSpecialistsCalendarCredentials } from '../repositories/specialistRepository.js';
import { refreshGoogleAccessToken } from './googleOAuthService.js';

export type ExternalBusySlot = {
  specialistId: number;
  scheduledAt: string;
  durationMin: number;
  source: 'google';
};

type GoogleCalendarEventDateTime = {
  dateTime?: string;
};

type GoogleCalendarEvent = {
  status?: string;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

function isAccessTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return true;
  }

  const safetyWindowMs = 30 * 1000;
  return expiresAt.getTime() <= Date.now() + safetyWindowMs;
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
      let googleApiKey = item.googleApiKey;
      if (isAccessTokenExpired(item.googleTokenExpiresAt) && item.googleRefreshToken) {
        const refreshed = await refreshGoogleAccessToken({
          accountId: input.accountId,
          webUserId: item.webUserId,
          refreshToken: item.googleRefreshToken,
        });

        if (refreshed) {
          googleApiKey = refreshed.googleApiKey;
        }
      }

      const calendarId = item.googleCalendarId?.trim() || 'primary';
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      try {
        const response = await axios.get<GoogleCalendarEventsResponse>(url, {
          headers: {
            Authorization: `Bearer ${googleApiKey}`,
          },
          params: {
            singleEvents: true,
            orderBy: 'startTime',
            timeMin: input.from.toISOString(),
            timeMax: input.to.toISOString(),
            maxResults: 2500,
          },
        });

        return (response.data.items ?? [])
          .filter((event) => event.status !== 'cancelled')
          .map((event) => {
            const durationMin = toDurationMin(event.start?.dateTime, event.end?.dateTime);
            if (!durationMin || !event.start?.dateTime) {
              return null;
            }

            return {
              specialistId: item.specialistId,
              scheduledAt: new Date(event.start.dateTime).toISOString(),
              durationMin,
              source: 'google' as const,
            };
          })
          .filter((slot): slot is ExternalBusySlot => Boolean(slot));
      } catch {
        return [];
      }
    }),
  );

  return busySlots.flat();
}
