import { describe, expect, it } from 'vitest';
import {
  getUtcRangeForTimezoneDate,
  toDateTimeFromUtc,
  toUtcIsoFromTimezone,
} from '../timezone';

describe('timezone utils', () => {
  it('converts local date/time to UTC ISO for Europe/Moscow', () => {
    expect(toUtcIsoFromTimezone('2026-04-18', '09:00', 'Europe/Moscow')).toBe(
      '2026-04-18T06:00:00.000Z',
    );
  });

  it('converts UTC datetime to local date/time in selected timezone', () => {
    expect(toDateTimeFromUtc('2026-04-18T06:00:00.000Z', 'Europe/Moscow')).toEqual({
      date: '2026-04-18',
      time: '09:00',
    });
  });

  it('builds UTC range for date (full day) in selected timezone', () => {
    expect(getUtcRangeForTimezoneDate('2026-04-18', 'Europe/Moscow')).toEqual({
      startIso: '2026-04-17T21:00:00.000Z',
      endIso: '2026-04-18T20:59:59.999Z',
    });
  });

  it('respects DST for Europe/Berlin', () => {
    expect(toUtcIsoFromTimezone('2026-07-01', '10:00', 'Europe/Berlin')).toBe(
      '2026-07-01T08:00:00.000Z',
    );
    expect(toDateTimeFromUtc('2026-07-01T08:00:00.000Z', 'Europe/Berlin')).toEqual({
      date: '2026-07-01',
      time: '10:00',
    });
  });

  it('throws on invalid date/time formats', () => {
    expect(() => toUtcIsoFromTimezone('2026/04/18', '09:00', 'Europe/Moscow')).toThrow(
      /Invalid date format/,
    );
    expect(() => toUtcIsoFromTimezone('2026-04-18', '9:00', 'Europe/Moscow')).toThrow(
      /Invalid time format/,
    );
    expect(() => getUtcRangeForTimezoneDate('2026-4-18', 'Europe/Moscow')).toThrow(
      /Invalid date format/,
    );
  });
});
