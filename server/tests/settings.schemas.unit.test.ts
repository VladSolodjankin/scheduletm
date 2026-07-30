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

  it('keeps locale and timezone in user settings', () => {
    const parsed = userSettingsSchema.safeParse({
      timezone: 'Europe/Samara',
      locale: 'ru-RU',
    });

    expect(parsed.success).toBe(true);
  });
});
