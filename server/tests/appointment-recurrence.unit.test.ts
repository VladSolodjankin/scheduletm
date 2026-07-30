import { describe, expect, it } from 'vitest';
import { appointmentCreateSchema } from '../src/config/schemas.js';
import { expandRecurrenceStartDates } from '../src/services/appointmentService.js';

const basePayload = {
  specialistId: 8,
  appointmentAt: '2026-08-01T10:00:00.000Z',
  appointmentEndAt: '2026-08-01T11:00:00.000Z',
  firstName: 'Guest',
  lastName: 'User',
  email: 'guest@example.com',
};

describe('appointment recurrence', () => {
  it('expands daily and weekly recurrences with fixed UTC offsets', () => {
    expect(expandRecurrenceStartDates(basePayload.appointmentAt, {
      frequency: 'daily',
      occurrences: 3,
    }).map((date) => date.toISOString())).toEqual([
      '2026-08-01T10:00:00.000Z',
      '2026-08-02T10:00:00.000Z',
      '2026-08-03T10:00:00.000Z',
    ]);
    expect(expandRecurrenceStartDates(basePayload.appointmentAt, {
      frequency: 'weekly',
      occurrences: 2,
    }).map((date) => date.toISOString())).toEqual([
      '2026-08-01T10:00:00.000Z',
      '2026-08-08T10:00:00.000Z',
    ]);
  });

  it('accepts an absent recurrence and enforces occurrence bounds', () => {
    expect(appointmentCreateSchema.safeParse(basePayload).success).toBe(true);
    expect(appointmentCreateSchema.safeParse({
      ...basePayload,
      recurrence: { frequency: 'daily', occurrences: 2 },
    }).success).toBe(true);
    expect(appointmentCreateSchema.safeParse({
      ...basePayload,
      recurrence: { frequency: 'daily', occurrences: 1 },
    }).success).toBe(false);
    expect(appointmentCreateSchema.safeParse({
      ...basePayload,
      recurrence: { frequency: 'weekly', occurrences: 53 },
    }).success).toBe(false);
  });
});
