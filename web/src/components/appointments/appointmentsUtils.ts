import type { AppointmentStatus } from '../../shared/types/api';

export type EditFormState = {
  specialistId: string;
  startDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
};

export type CalendarViewMode = 'day' | 'week' | 'month';

export const STATUS_OPTIONS: AppointmentStatus[] = ['new', 'confirmed', 'cancelled'];
export const DEFAULT_SLOT_STEP_MIN = 30;
export const SLOT_ROWS = Array.from({ length: 48 }, (_, index) => index * 30);
export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const FALLBACK_TIMEZONES = ['UTC', BROWSER_TIMEZONE];
export const AVAILABLE_TIMEZONES = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : FALLBACK_TIMEZONES;

export function getDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '00';

  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  };
}

export function toDatetimeLocal(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = getDateTimeParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function fromDatetimeLocal(value: string, timeZone: string): string {
  const parsed = new Date(value);
  const parsedMs = parsed.getTime();
  if (!Number.isNaN(parsedMs)) {
    return parsed.toISOString();
  }

  const [datePart, timePart] = value.split('T');

  if (!datePart || !timePart) {
    return new Date().toISOString();
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const targetMinutes = (((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute;

  let guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 3; i += 1) {
    const guessDate = new Date(guessUtcMs);
    const guessParts = getDateTimeParts(guessDate, timeZone);
    const guessMinutes = (((guessParts.year * 12 + guessParts.month) * 31 + guessParts.day) * 24 + guessParts.hour) * 60 + guessParts.minute;
    const diffMinutes = guessMinutes - targetMinutes;

    if (diffMinutes === 0) {
      break;
    }

    guessUtcMs -= diffMinutes * 60 * 1000;
  }

  return new Date(guessUtcMs).toISOString();
}

export function toDateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = getDateTimeParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function toTimeKeyInTimezone(date: Date, timeZone: string): string {
  const parts = getDateTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function createDatetimeLocal(dateKey: string, hour: number, minute = 0): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateKey}T${pad(hour)}:${pad(minute)}`;
}

export function isSlotInPast(dateKey: string, hour: number, minute: number, timeZone: string): boolean {
  const slotIso = fromDatetimeLocal(createDatetimeLocal(dateKey, hour, minute), timeZone);
  return new Date(slotIso).getTime() < Date.now();
}

export function addMinutesToDatetimeLocal(value: string, minutesToAdd: number, timeZone: string): string {
  const iso = fromDatetimeLocal(value, timeZone);
  return toDatetimeLocal(new Date(new Date(iso).getTime() + minutesToAdd * 60_000).toISOString(), timeZone);
}

export function getUtcNowByTimeZone(timeZone: string): Date {
  const now = new Date();
  const nowLocal = toDatetimeLocal(now.toISOString(), timeZone);
  const todayKey = nowLocal.slice(0, 10);

  return new Date(fromDatetimeLocal(`${todayKey}T00:00`, timeZone));
}

export function formatLocalDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(undefined, options);
}

export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusLabel(status: AppointmentStatus): string {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'cancelled') return 'cancelled';
  return 'new';
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function weekStart(date: Date): Date {
  const base = startOfDay(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function splitLocalDateTime(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

export function composeFormDateTime(date: string, time: string): string {
  return `${date}T${time}`;
}

export function createFormValuesFromAppointmentAt(appointmentAtIso: string, durationMin: number, timeZone: string) {
  const startAt = toDatetimeLocal(appointmentAtIso, timeZone);
  const endAt = addMinutesToDatetimeLocal(startAt, durationMin, timeZone);
  const startParts = splitLocalDateTime(startAt);
  const endParts = splitLocalDateTime(endAt);

  return {
    startDate: startParts.date,
    startTime: startParts.time,
    endTime: endParts.time,
  };
}

export function buildStartEndIso(form: EditFormState, timeZone: string) {
  const startLocal = composeFormDateTime(form.startDate, form.startTime);
  const startIso = fromDatetimeLocal(startLocal, timeZone);

  let endDate = form.startDate;
  if (form.endTime <= form.startTime) {
    const startDate = new Date(`${form.startDate}T00:00:00`);
    const nextDate = addDays(startDate, 1);
    endDate = nextDate.toISOString().slice(0, 10);
  }

  const endIso = fromDatetimeLocal(composeFormDateTime(endDate, form.endTime), timeZone);
  return { startIso, endIso };
}
