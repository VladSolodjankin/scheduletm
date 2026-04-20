import { db } from '../db/knex.js';

export type WebUserRecord = {
  id: number;
  account_id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

type CreateWebUserInput = {
  accountId: number;
  email: string;
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
