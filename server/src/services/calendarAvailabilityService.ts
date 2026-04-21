import axios from 'axios';
import { findSpecialistsCalendarCredentials } from '../repositories/specialistRepository.js';

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
      const calendarId = item.googleCalendarId?.trim() || 'primary';
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      try {
        const response = await axios.get<GoogleCalendarEventsResponse>(url, {
          headers: {
            Authorization: `Bearer ${item.googleApiKey}`,
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
