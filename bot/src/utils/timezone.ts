function parseDateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid date format: ${date}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeParts(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error(`Invalid time format: ${time}`);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function formatDateTimeInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hours: Number(map.hour),
    minutes: Number(map.minute),
    seconds: Number(map.second),
  };
}

function formatDateInTimezone(date: Date, timezone: string) {
  const formatted = formatDateTimeInTimezone(date, timezone);

  return {
    date: `${String(formatted.year).padStart(4, '0')}-${String(formatted.month).padStart(2, '0')}-${String(formatted.day).padStart(2, '0')}`,
    time: `${String(formatted.hours).padStart(2, '0')}:${String(formatted.minutes).padStart(2, '0')}`,
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const zoned = formatDateTimeInTimezone(date, timezone);
  const asUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hours,
    zoned.minutes,
    zoned.seconds,
  );

  return asUtcMs - date.getTime();
}

function toUtcDateFromTimezone(date: string, time: string, timezone: string) {
  const { year, month, day } = parseDateParts(date);
  const { hours, minutes } = parseTimeParts(time);

  const naiveUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const initialOffset = getTimezoneOffsetMs(new Date(naiveUtcMs), timezone);
  const firstPassUtcMs = naiveUtcMs - initialOffset;
  const finalOffset = getTimezoneOffsetMs(new Date(firstPassUtcMs), timezone);

  return new Date(naiveUtcMs - finalOffset);
}

function addDays(date: string, days: number) {
  const { year, month, day } = parseDateParts(date);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);

  const nextYear = utcDate.getUTCFullYear();
  const nextMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(utcDate.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function toUtcIsoFromTimezone(date: string, time: string, timezone: string) {
  return toUtcDateFromTimezone(date, time, timezone).toISOString();
}

export function toDateTimeFromUtc(value: string | Date, timezone: string) {
  const date = value instanceof Date ? value : new Date(value);
  return formatDateInTimezone(date, timezone);
}

export function getUtcRangeForTimezoneDate(date: string, timezone: string) {
  const start = toUtcDateFromTimezone(date, '00:00', timezone);
  const nextDayStart = toUtcDateFromTimezone(addDays(date, 1), '00:00', timezone);

  return {
    startIso: start.toISOString(),
    endIso: new Date(nextDayStart.getTime() - 1).toISOString(),
  };
}

export function getCurrentDateInTimezone(timezone: string, now = new Date()) {
  return formatDateInTimezone(now, timezone).date;
}

export function getDateAfterDays(date: string, days: number) {
  return addDays(date, days);
}
