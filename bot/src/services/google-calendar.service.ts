import axios from 'axios';
import { findSpecialistById } from '../repositories/specialist.repository';
import { getDateAfterDays, toDateTimeFromUtc, toUtcIsoFromTimezone } from '../utils/timezone';
import { logWarn } from '../utils/logger';

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

type BusyInterval = {
  date: string;
  time: string;
  durationMin: number;
};

function getGoogleCalendarConfig(specialist: {
  google_api_key?: string | null;
  google_calendar_id?: string | null;
}) {
  const googleApiKey = specialist.google_api_key?.trim();
  const googleCalendarId = specialist.google_calendar_id?.trim();

  if (!googleApiKey || !googleCalendarId) {
    return null;
  }

  return {
    googleApiKey,
    googleCalendarId,
  };
}

function toBusyInterval(startIso: string, endIso: string, timezone: string): BusyInterval | null {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const durationMin = Math.round((end.getTime() - start.getTime()) / (60 * 1000));

  if (durationMin <= 0) {
    return null;
  }

  const dateTime = toDateTimeFromUtc(startIso, timezone);

  return {
    date: dateTime.date,
    time: dateTime.time,
    durationMin,
  };
}

export async function getBusyIntervalsFromGoogleCalendar(input: {
  accountId: number;
  specialistId: number;
  date: string;
  timezone: string;
}): Promise<BusyInterval[]> {
  const specialist = await findSpecialistById(input.accountId, input.specialistId);

  if (!specialist) {
    return [];
  }

  const calendarConfig = getGoogleCalendarConfig(specialist);
  if (!calendarConfig) {
    return [];
  }

  const startIso = toUtcIsoFromTimezone(input.date, '00:00', input.timezone);
  const endIso = toUtcIsoFromTimezone(getDateAfterDays(input.date, 365), '23:59', input.timezone);

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.googleCalendarId)}/events`;

    const response = await axios.get<GoogleCalendarEventsResponse>(url, {
      params: {
        key: calendarConfig.googleApiKey,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: startIso,
        timeMax: endIso,
        maxResults: 2500,
      },
    });

    return (response.data.items ?? [])
      .filter((event) => event.status !== 'cancelled')
      .map((event) => {
        if (!event.start?.dateTime || !event.end?.dateTime) {
          return null;
        }

        return toBusyInterval(event.start.dateTime, event.end.dateTime, input.timezone);
      })
      .filter((event): event is BusyInterval => Boolean(event));
  } catch (error) {
    logWarn('google_calendar.busy_fetch_failed', {
      account_id: input.accountId,
      specialist_id: input.specialistId,
    });

    return [];
  }
}

export async function createGoogleCalendarEvents(input: {
  accountId: number;
  specialistId: number;
  appointments: Array<{ id: number; appointment_at: string | Date; duration_min: number }>;
  serviceName: string;
  specialistName: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
}) {
  const specialist = await findSpecialistById(input.accountId, input.specialistId);

  if (!specialist) {
    return { sent: 0, skipped: input.appointments.length };
  }

  const calendarConfig = getGoogleCalendarConfig(specialist);
  if (!calendarConfig) {
    return { sent: 0, skipped: input.appointments.length };
  }

  let sent = 0;

  for (const appointment of input.appointments) {
    const startIso = new Date(appointment.appointment_at).toISOString();
    const endIso = new Date(
      new Date(appointment.appointment_at).getTime() + appointment.duration_min * 60 * 1000,
    ).toISOString();

    const descriptionLines = [
      `Specialist: ${input.specialistName}`,
      `Client: ${input.clientName ?? 'Client'}`,
      input.clientPhone ? `Phone: ${input.clientPhone}` : null,
      input.clientEmail ? `Email: ${input.clientEmail}` : null,
      `Appointment ID: ${appointment.id}`,
    ].filter((line): line is string => Boolean(line));

    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.googleCalendarId)}/events`;

      await axios.post(
        url,
        {
          summary: input.serviceName,
          description: descriptionLines.join('\n'),
          start: { dateTime: startIso },
          end: { dateTime: endIso },
        },
        {
          params: {
            key: calendarConfig.googleApiKey,
          },
        },
      );

      sent += 1;
    } catch (error) {
      logWarn('google_calendar.create_event_failed', {
        account_id: input.accountId,
        specialist_id: input.specialistId,
        appointment_id: appointment.id,
      });
    }
  }

  return {
    sent,
    skipped: input.appointments.length - sent,
  };
}
