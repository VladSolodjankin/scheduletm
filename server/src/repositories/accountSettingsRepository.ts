import { db } from '../db/knex.js';

export type AccountSettingsRecord = {
  id: number;
  account_id: number;
  timezone: string;
  slot_duration_min: number;
  daily_digest_enabled: boolean;
  week_starts_on_monday: boolean;
  locale: string;
  business_address: string;
  business_lat: string | null;
  business_lng: string | null;
};

export type UpdateAccountSettingsInput = {
  accountId: number;
  timezone?: string;
  slotDurationMin?: number;
  dailyDigestEnabled?: boolean;
  weekStartsOnMonday?: boolean;
  locale?: string;
  businessAddress?: string;
  businessLat?: number | null;
  businessLng?: number | null;
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
  if (input.businessAddress !== undefined) {
    patch.business_address = input.businessAddress;
  }
  if (input.businessLat !== undefined) {
    patch.business_lat = input.businessLat;
  }
  if (input.businessLng !== undefined) {
    patch.business_lng = input.businessLng;
  }

  await db('account_settings')
    .insert({
      account_id: input.accountId,
      timezone: input.timezone ?? 'UTC',
      slot_duration_min: input.slotDurationMin ?? 30,
      daily_digest_enabled: input.dailyDigestEnabled ?? true,
      week_starts_on_monday: input.weekStartsOnMonday ?? true,
      locale: input.locale ?? 'ru-RU',
      business_address: input.businessAddress ?? '',
      business_lat: input.businessLat ?? null,
      business_lng: input.businessLng ?? null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id'])
    .merge(patch);
}
