import { db } from '../db/knex.js';
import { type WebUserRole } from '../types/webUserRole.js';

export type WebUserRecord = {
  id: number;
  account_id: number;
  email: string;
  role: WebUserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  telegram_username: string | null;
  client_id: number | null;
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
  email_verified_at: Date | null;
  email_verification_code: string | null;
  email_verification_sent_at: Date | null;
  phone_verified_at: Date | null;
};

type CreateWebUserInput = {
  accountId: number;
  email: string;
  role: WebUserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  telegramUsername?: string;
  passwordHash: string;
  passwordSalt: string;
  timezone?: string;
  emailVerificationCode?: string | null;
  emailVerificationSentAt?: Date | null;
  emailVerifiedAt?: Date | null;
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

export async function findWebUserByEmailAnyAccount(email: string): Promise<WebUserRecord | null> {
  const row = await db('web_users')
    .where({ email })
    .orderBy('id', 'asc')
    .first<WebUserRecord>();

  return row ?? null;
}

export async function findWebUserById(accountId: number, id: number): Promise<WebUserRecord | null> {
  const row = await db('web_users')
    .where({ account_id: accountId, id })
    .first<WebUserRecord>();

  return row ?? null;
}

export async function findWebUserByIdAnyAccount(id: number): Promise<WebUserRecord | null> {
  const row = await db('web_users')
    .where({ id })
    .first<WebUserRecord>();

  return row ?? null;
}

export async function listWebUsersByAccount(accountId: number): Promise<WebUserRecord[]> {
  return db('web_users')
    .where({ account_id: accountId })
    .orderBy('created_at', 'desc');
}

export async function listWebUsersAllAccounts(): Promise<WebUserRecord[]> {
  return db('web_users')
    .orderBy('created_at', 'desc');
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
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      phone: input.phone ?? null,
      telegram_username: input.telegramUsername ?? null,
      password_hash: input.passwordHash,
      password_salt: input.passwordSalt,
      timezone: input.timezone ?? 'UTC',
      email_verification_code: input.emailVerificationCode ?? null,
      email_verification_sent_at: input.emailVerificationSentAt ?? null,
      email_verified_at: input.emailVerifiedAt ?? null,
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

type UpdateWebUserAuthStateInput = {
  accountId: number;
  id: number;
  emailVerificationCode?: string | null;
  emailVerificationSentAt?: Date | null;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
};

export async function updateWebUserAuthState(input: UpdateWebUserAuthStateInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.emailVerificationCode !== undefined) {
    patch.email_verification_code = input.emailVerificationCode;
  }

  if (input.emailVerificationSentAt !== undefined) {
    patch.email_verification_sent_at = input.emailVerificationSentAt;
  }

  if (input.emailVerifiedAt !== undefined) {
    patch.email_verified_at = input.emailVerifiedAt;
  }

  if (input.phoneVerifiedAt !== undefined) {
    patch.phone_verified_at = input.phoneVerifiedAt;
  }

  await db('web_users')
    .where({ account_id: input.accountId, id: input.id })
    .update(patch);
}

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

type UpdateWebUserProfileInput = {
  accountId: number;
  id: number;
  role?: WebUserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  telegramUsername?: string;
  email?: string;
  isActive?: boolean;
  clientId?: number | null;
};

export async function updateWebUserProfile(input: UpdateWebUserProfileInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.role !== undefined) {
    patch.role = input.role;
  }

  if (input.email !== undefined) {
    patch.email = input.email;
  }

  if (input.firstName !== undefined) {
    patch.first_name = input.firstName;
  }

  if (input.lastName !== undefined) {
    patch.last_name = input.lastName;
  }

  if (input.phone !== undefined) {
    patch.phone = input.phone;
  }

  if (input.telegramUsername !== undefined) {
    patch.telegram_username = input.telegramUsername;
  }

  if (input.isActive !== undefined) {
    patch.is_active = input.isActive;
  }

  if (input.clientId !== undefined) {
    patch.client_id = input.clientId;
  }

  await db('web_users')
    .where({ account_id: input.accountId, id: input.id })
    .update(patch);
}
