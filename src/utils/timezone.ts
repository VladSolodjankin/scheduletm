const MOSCOW_OFFSET_MINUTES = 3 * 60;

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

function toUtcDateFromMoscow(date: string, time: string) {
  const { year, month, day } = parseDateParts(date);
  const { hours, minutes } = parseTimeParts(time);

  const utcMs = Date.UTC(year, month - 1, day, hours, minutes)
    - MOSCOW_OFFSET_MINUTES * 60_000;

  return new Date(utcMs);
}

export function toUtcIsoFromMoscow(date: string, time: string) {
  return toUtcDateFromMoscow(date, time).toISOString();
}

export function toMoscowDateTimeFromUtc(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const moscowMs = date.getTime() + MOSCOW_OFFSET_MINUTES * 60_000;
  const moscowDate = new Date(moscowMs);

  const year = moscowDate.getUTCFullYear();
  const month = String(moscowDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(moscowDate.getUTCDate()).padStart(2, '0');
  const hours = String(moscowDate.getUTCHours()).padStart(2, '0');
  const minutes = String(moscowDate.getUTCMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

export function getUtcRangeForMoscowDate(date: string) {
  const start = toUtcDateFromMoscow(date, '00:00');
  const end = toUtcDateFromMoscow(date, '23:59');
  end.setUTCSeconds(59, 999);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
