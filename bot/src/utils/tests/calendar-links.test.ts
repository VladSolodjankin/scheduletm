import { describe, expect, it } from 'vitest';

import {
  buildAppleCalendarIcs,
  buildAppleCalendarLink,
  buildCalendarLink,
  buildMicrosoftCalendarLink,
} from '../calendar-links';

describe('calendar links utils', () => {
  it('builds google calendar link', () => {
    const url = buildCalendarLink('2026-04-19', '09:30', 'Consultation', 'Europe/Moscow', 45);
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Consultation');
  });

  it('builds apple calendar ics link', () => {
    const url = buildAppleCalendarLink(
      'https://app.example.com',
      '2026-04-19',
      '09:30',
      'Consultation',
      'Europe/Moscow',
      45,
    );

    expect(url).toContain('https://app.example.com/calendar/apple.ics?');
    expect(url).toContain('durationMin=45');
  });

  it('builds microsoft calendar deeplink', () => {
    const url = buildMicrosoftCalendarLink('2026-04-19', '09:30', 'Consultation', 'Europe/Moscow', 45);
    expect(url).toContain('outlook.live.com/calendar/0/deeplink/compose');
    expect(url).toContain('rru=addevent');
  });

  it('builds apple ics body', () => {
    const ics = buildAppleCalendarIcs('2026-04-19', '09:30', 'Consultation', 'Europe/Moscow', 45);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Consultation');
    expect(ics).toContain('DTSTART;TZID=Europe/Moscow:20260419T093000');
  });
});
