function pad(value: number) {
  return String(value).padStart(2, '0');
}

function parseDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  return { year, month, day, hours, minutes };
}

function buildEndDateTime(date: string, time: string, durationMin: number) {
  const { year, month, day, hours, minutes } = parseDateTime(date, time);
  const endDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  endDateTime.setUTCMinutes(endDateTime.getUTCMinutes() + durationMin);

  return {
    date: `${endDateTime.getUTCFullYear()}-${pad(endDateTime.getUTCMonth() + 1)}-${pad(endDateTime.getUTCDate())}`,
    time: `${pad(endDateTime.getUTCHours())}:${pad(endDateTime.getUTCMinutes())}`,
  };
}

export function buildCalendarLink(
  date: string,
  time: string,
  title: string,
  timezone: string,
  durationMin: number,
) {
  const compactDate = date.replace(/-/g, '');
  const compactTime = time.replace(':', '');
  const [hours, minutes] = time.split(':').map(Number);

  const endDateTime = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  endDateTime.setUTCMinutes(endDateTime.getUTCMinutes() + durationMin);

  const end = `${compactDate}T${String(endDateTime.getUTCHours()).padStart(2, '0')}${String(
    endDateTime.getUTCMinutes(),
  ).padStart(2, '0')}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${compactDate}T${compactTime}00/${end}`,
    ctz: timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildMicrosoftCalendarLink(
  date: string,
  time: string,
  title: string,
  timezone: string,
  durationMin: number,
) {
  const end = buildEndDateTime(date, time, durationMin);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    startdt: `${date}T${time}:00`,
    enddt: `${end.date}T${end.time}:00`,
    ctzt: timezone,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function buildAppleCalendarLink(
  appUrl: string,
  date: string,
  time: string,
  title: string,
  timezone: string,
  durationMin: number,
) {
  const params = new URLSearchParams({
    date,
    time,
    title,
    timezone,
    durationMin: String(durationMin),
  });

  return `${appUrl}/calendar/apple.ics?${params.toString()}`;
}

export function buildAppleCalendarIcs(
  date: string,
  time: string,
  title: string,
  timezone: string,
  durationMin: number,
) {
  const compactStartDate = date.replace(/-/g, '');
  const compactStartTime = time.replace(':', '');
  const end = buildEndDateTime(date, time, durationMin);
  const compactEndDate = end.date.replace(/-/g, '');
  const compactEndTime = end.time.replace(':', '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScheduleTM//Booking//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${title.replace(/\n/g, ' ')}`,
    `DTSTART;TZID=${timezone}:${compactStartDate}T${compactStartTime}00`,
    `DTEND;TZID=${timezone}:${compactEndDate}T${compactEndTime}00`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
