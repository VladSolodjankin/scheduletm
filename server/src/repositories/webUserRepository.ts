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
  google_api_key: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: Date | null;
  google_calendar_id: string | null;
  google_connected_at: Date | null;
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

type UpdateWebUserGoogleCredentialsInput = {
  accountId: number;
  id: number;
  googleApiKey: string;
  googleRefreshToken?: string | null;
  googleTokenExpiresAt?: Date | null;
  googleCalendarId?: string | null;
};

export async function updateWebUserGoogleCredentials(
  input: UpdateWebUserGoogleCredentialsInput,
): Promise<void> {
  const patch: Record<string, unknown> = {
    google_api_key: input.googleApiKey,
    google_connected_at: db.fn.now(),
    updated_at: db.fn.now(),
  };

  if (input.googleRefreshToken !== undefined) {
    patch.google_refresh_token = input.googleRefreshToken;
  }

  if (input.googleTokenExpiresAt !== undefined) {
    patch.google_token_expires_at = input.googleTokenExpiresAt;
  }

  if (input.googleCalendarId !== undefined) {
    patch.google_calendar_id = input.googleCalendarId;
  }

  await db('web_users')
    .where({ account_id: input.accountId, id: input.id })
    .update(patch);
}

export async function clearWebUserGoogleCredentials(accountId: number, id: number): Promise<void> {
  await db('web_users')
    .where({ account_id: accountId, id })
    .update({
      google_api_key: null,
      google_refresh_token: null,
      google_token_expires_at: null,
      google_calendar_id: null,
      google_connected_at: null,
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
