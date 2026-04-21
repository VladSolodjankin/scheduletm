import { db } from '../db/knex.js';

export type AppSettingsRecord = {
  id: number;
  account_id: number;
  timezone: string;
  slot_duration_min: number;
  daily_digest_enabled: boolean;
  week_starts_on_monday: boolean;
  locale: string;
};

export type UpdateAppSettingsInput = {
  accountId: number;
  timezone?: string;
  slotDurationMin?: number;
  dailyDigestEnabled?: boolean;
  weekStartsOnMonday?: boolean;
  locale?: string;
};

const baseQuery = (accountId: number) => db('app_settings').where({ account_id: accountId });

export async function findAppSettingsByAccountId(accountId: number): Promise<AppSettingsRecord | null> {
  const row = await baseQuery(accountId).first<AppSettingsRecord>();
  return row ?? null;
}

export async function updateAppSettingsByAccountId(input: UpdateAppSettingsInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.timezone !== undefined) {
    patch.timezone = input.timezone;
  }

  if (input.slotDurationMin !== undefined) {
    patch.slot_duration_min = input.slotDurationMin;
  }

  if (input.dailyDigestEnabled !== undefined) {
    patch.daily_digest_enabled = input.dailyDigestEnabled;
  }

  if (input.weekStartsOnMonday !== undefined) {
    patch.week_starts_on_monday = input.weekStartsOnMonday;
  }

  if (input.locale !== undefined) {
    patch.locale = input.locale;
  }

  await baseQuery(input.accountId).update(patch);
}
