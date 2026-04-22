import {
  createGoogleCalendarEvents,
  getBusyIntervalsFromGoogleCalendar,
  rescheduleGoogleCalendarEvent,
} from './google-calendar.service';

type CalendarBusyInterval = {
  date: string;
  time: string;
  durationMin: number;
};

export async function getBusyIntervalsFromExternalCalendars(input: {
  accountId: number;
  specialistId: number;
  date: string;
  timezone: string;
}): Promise<CalendarBusyInterval[]> {
  const googleBusyIntervals = await getBusyIntervalsFromGoogleCalendar(input);
  return googleBusyIntervals;
}

export async function syncAppointmentsToExternalCalendars(input: {
  accountId: number;
  specialistId: number;
  appointments: Array<{ id: number; appointment_at: string | Date; duration_min: number }>;
  serviceName: string;
  specialistName: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
}) {
  return createGoogleCalendarEvents(input);
}

export async function syncAppointmentRescheduledInExternalCalendars(input: {
  accountId: number;
  specialistId: number;
  appointmentId: number;
  appointmentAt: string | Date;
  durationMin: number;
}) {
  return rescheduleGoogleCalendarEvent(input);
}
