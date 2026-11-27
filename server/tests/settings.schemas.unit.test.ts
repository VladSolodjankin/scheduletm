import { describe, expect, it } from 'vitest';
import { accountSettingsSchema, userSettingsSchema } from '../src/config/schemas.js';

describe('settings schemas', () => {
  it('keeps locale and timezone out of account settings', () => {
    const parsed = accountSettingsSchema.parse({
      timezone: 'Europe/Samara',
      locale: 'ru-RU',
      defaultMeetingDuration: 60,
    });

    expect(parsed).toEqual({ defaultMeetingDuration: 60 });
  });

  it('accepts unique ISO weekdays as work days', () => {
    expect(accountSettingsSchema.parse({ workDays: [5, 1, 7] })).toEqual({ workDays: [5, 1, 7] });
    for (const workDays of [[], [0], [8], [1, 1], [1, 2, 3, 4, 5, 6, 7, 1], [1.5]]) {
      expect(accountSettingsSchema.safeParse({ workDays }).success).toBe(false);
    }
  });

  it('keeps locale and timezone in user settings', () => {
    const parsed = userSettingsSchema.safeParse({
      timezone: 'Europe/Samara',
      locale: 'ru-RU',
    });

    expect(parsed.success).toBe(true);
  });
});
