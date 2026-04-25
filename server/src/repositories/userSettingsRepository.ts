import { db } from '../db/knex.js';

export type UserSettingsRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  timezone: string;
  locale: string;
  ui_theme_mode: 'light' | 'dark';
  ui_palette_variant_id: string;
};

type UpdateUserSettingsInput = {
  accountId: number;
  webUserId: number;
  timezone?: string;
  locale?: string;
  uiThemeMode?: 'light' | 'dark';
  uiPaletteVariantId?: string;
};

export async function findUserSettingsByWebUserId(accountId: number, webUserId: number): Promise<UserSettingsRecord | null> {
  const row = await db('user_settings')
    .where({ account_id: accountId, web_user_id: webUserId })
    .first<UserSettingsRecord>();

  return row ?? null;
}

export async function updateUserSettingsByWebUserId(input: UpdateUserSettingsInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.timezone !== undefined) {
    patch.timezone = input.timezone;
  }

  if (input.locale !== undefined) {
    patch.locale = input.locale;
  }

  if (input.uiThemeMode !== undefined) {
    patch.ui_theme_mode = input.uiThemeMode;
  }

  if (input.uiPaletteVariantId !== undefined) {
    patch.ui_palette_variant_id = input.uiPaletteVariantId;
  }

  await db('user_settings')
    .insert({
      account_id: input.accountId,
      web_user_id: input.webUserId,
      timezone: input.timezone ?? 'UTC',
      locale: input.locale ?? 'ru-RU',
      ui_theme_mode: input.uiThemeMode ?? 'light',
      ui_palette_variant_id: input.uiPaletteVariantId ?? 'default',
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id', 'web_user_id'])
    .merge(patch);
}
