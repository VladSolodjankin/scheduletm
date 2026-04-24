import { db } from '../db/knex.js';
import { type WebUserRole } from '../types/webUserRole.js';

export type WebUserRecord = {
  id: number;
  account_id: number;
  email: string;
  role: WebUserRole;
  password_hash: string;
  password_salt: string;
  is_active: boolean;
  timezone: string;
  locale: string;
  ui_theme_mode: 'light' | 'dark';
  ui_palette_variant_id: string;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

type CreateWebUserInput = {
  accountId: number;
  email: string;
  role: WebUserRole;
  passwordHash: string;
  passwordSalt: string;
  timezone?: string;
};

export type SpecialistWebUserOption = {
  id: number;
  email: string;
};

export async function findWebUserByEmail(accountId: number, email: string): Promise<WebUserRecord | null> {
  const row = await db('web_users')
    .where({ account_id: accountId, email })
    .first<WebUserRecord>();

  return row ?? null;
}

export async function findWebUserById(accountId: number, id: number): Promise<WebUserRecord | null> {
  const row = await db('web_users')
    .where({ account_id: accountId, id })
    .first<WebUserRecord>();

  return row ?? null;
}

export async function listActiveSpecialistWebUsersWithoutProfile(accountId: number): Promise<SpecialistWebUserOption[]> {
  return db('web_users as wu')
    .leftJoin('specialists as s', function joinSpecialists() {
      this.on('s.user_id', '=', 'wu.id').andOn('s.account_id', '=', 'wu.account_id');
    })
    .where('wu.account_id', accountId)
    .where('wu.role', 'specialist')
    .where('wu.is_active', true)
    .whereNull('s.id')
    .orderBy('wu.email', 'asc')
    .select('wu.id', 'wu.email');
}

export async function createWebUser(input: CreateWebUserInput): Promise<WebUserRecord> {
  const [row] = await db('web_users')
    .insert({
      account_id: input.accountId,
      email: input.email,
      role: input.role,
      password_hash: input.passwordHash,
      password_salt: input.passwordSalt,
      timezone: input.timezone ?? 'UTC',
      is_active: true,
    })
    .returning<WebUserRecord[]>('*');

  return row;
}

export async function touchWebUserLastLogin(accountId: number, id: number): Promise<void> {
  await db('web_users')
    .where({ account_id: accountId, id })
    .update({
      last_login_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}

type UpdateWebUserSettingsInput = {
  accountId: number;
  id: number;
  timezone?: string;
  locale?: string;
  uiThemeMode?: 'light' | 'dark';
  uiPaletteVariantId?: string;
};

export async function updateWebUserSettings(input: UpdateWebUserSettingsInput): Promise<void> {
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

  await db('web_users')
    .where({ account_id: input.accountId, id: input.id })
    .update(patch);
}
