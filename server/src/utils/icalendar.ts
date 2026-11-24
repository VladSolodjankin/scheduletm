/** Minimal RFC 5545 helpers for the read-only calendar feed. Lines are CRLF terminated and folded at 75 octets. */

const encoder = new TextEncoder();

/** Escapes a TEXT value: backslash, semicolon, comma and line breaks. */
export function escapeIcsText(value: string): string {
  return value
    // Drop control characters other than line breaks, which are escaped below.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line to at most 75 octets per physical line without splitting a UTF-8 character. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) {
    return line;
  }

  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  // Continuation lines start with one space, which counts toward their 75 octets.
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** 20261101T100000Z */
export function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export type IcsEvent = {
  uid: string;
  stamp: Date;
  start: Date;
  end: Date;
  lastModified: Date;
  sequence: number;
  summary: string;
  location?: string;
};

export function buildIcsCalendar(input: { name: string; prodId: string; events: IcsEvent[] }): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${input.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(input.name)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const event of input.events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${formatIcsUtc(event.stamp)}`,
      `DTSTART:${formatIcsUtc(event.start)}`,
      `DTEND:${formatIcsUtc(event.end)}`,
      `LAST-MODIFIED:${formatIcsUtc(event.lastModified)}`,
      `SEQUENCE:${event.sequence}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
