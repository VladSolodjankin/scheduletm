import { db } from '../db/knex.js';

export type AccountSettingsRecord = {
  id: number;
  account_id: number;
  timezone: string;
  slot_duration_min: number;
  daily_digest_enabled: boolean;
  week_starts_on_monday: boolean;
  locale: string;
};

export type UpdateAccountSettingsInput = {
  accountId: number;
  timezone?: string;
  slotDurationMin?: number;
  dailyDigestEnabled?: boolean;
  weekStartsOnMonday?: boolean;
  locale?: string;
};

const baseQuery = (accountId: number) => db('account_settings').where({ account_id: accountId });

export async function findAccountSettingsByAccountId(accountId: number): Promise<AccountSettingsRecord | null> {
  const row = await baseQuery(accountId).first<AccountSettingsRecord>();
  return row ?? null;
}

export async function updateAccountSettingsByAccountId(input: UpdateAccountSettingsInput): Promise<void> {
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

  await db('account_settings')
    .insert({
      account_id: input.accountId,
      timezone: input.timezone ?? 'UTC',
      slot_duration_min: input.slotDurationMin ?? 30,
      daily_digest_enabled: input.dailyDigestEnabled ?? true,
      week_starts_on_monday: input.weekStartsOnMonday ?? true,
      locale: input.locale ?? 'ru-RU',
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id'])
    .merge(patch);
}
