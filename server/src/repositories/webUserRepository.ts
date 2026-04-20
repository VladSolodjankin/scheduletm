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
  google_calendar_id: string | null;
  google_connected_at: Date | null;
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
  googleCalendarId?: string | null;
};

export async function updateWebUserGoogleCredentials(
  input: UpdateWebUserGoogleCredentialsInput,
): Promise<void> {
  await db('web_users')
    .where({ account_id: input.accountId, id: input.id })
    .update({
      google_api_key: input.googleApiKey,
      google_calendar_id: input.googleCalendarId ?? null,
      google_connected_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}
