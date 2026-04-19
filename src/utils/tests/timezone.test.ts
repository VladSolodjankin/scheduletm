import { describe, expect, it } from 'vitest';
import {
  getUtcRangeForMoscowDate,
  toMoscowDateTimeFromUtc,
  toUtcIsoFromMoscow,
} from '../timezone';

describe('timezone utils', () => {
  it('converts Moscow date/time to UTC ISO', () => {
    // Moscow is treated as fixed UTC+3 in this project logic.
    expect(toUtcIsoFromMoscow('2026-04-18', '09:00')).toBe('2026-04-18T06:00:00.000Z');
  });

  it('converts UTC datetime to Moscow date/time', () => {
    expect(toMoscowDateTimeFromUtc('2026-04-18T06:00:00.000Z')).toEqual({
      date: '2026-04-18',
      time: '09:00',
    });
  });

  it('builds UTC range for a Moscow date (full day)', () => {
    expect(getUtcRangeForMoscowDate('2026-04-18')).toEqual({
      startIso: '2026-04-17T21:00:00.000Z',
      endIso: '2026-04-18T20:59:59.999Z',
    });
  });

  it('handles day boundaries when converting UTC to Moscow date/time', () => {
    // 21:00Z + 3h => 00:00 next day in Moscow time
    expect(toMoscowDateTimeFromUtc('2026-04-17T21:00:00.000Z')).toEqual({
      date: '2026-04-18',
      time: '00:00',
    });
  });

  it('throws on invalid date/time formats', () => {
    expect(() => toUtcIsoFromMoscow('2026/04/18', '09:00')).toThrow(/Invalid date format/);
    expect(() => toUtcIsoFromMoscow('2026-04-18', '9:00')).toThrow(/Invalid time format/);
    expect(() => getUtcRangeForMoscowDate('2026-4-18')).toThrow(/Invalid date format/);
  });
});
