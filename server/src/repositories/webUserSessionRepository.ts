import { db } from '../db/knex.js';

export type WebSessionType = 'access' | 'refresh';

type WebUserSessionRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  token: string;
  session_type: WebSessionType;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type CreateWebUserSessionInput = {
  accountId: number;
  webUserId: number;
  token: string;
  sessionType: WebSessionType;
  expiresAt: Date;
};

export async function createWebUserSession(input: CreateWebUserSessionInput): Promise<void> {
  await db('web_user_sessions').insert({
    account_id: input.accountId,
    web_user_id: input.webUserId,
    token: input.token,
    session_type: input.sessionType,
    expires_at: input.expiresAt,
  });
}

export async function findActiveWebUserSessionByToken(
  accountId: number,
  token: string,
  sessionType: WebSessionType,
): Promise<WebUserSessionRecord | null> {
  const row = await db('web_user_sessions')
    .where({
      account_id: accountId,
      token,
      session_type: sessionType,
    })
    .whereNull('revoked_at')
    .where('expires_at', '>', db.fn.now())
    .first<WebUserSessionRecord>();

  return row ?? null;
}

export async function findActiveWebUserSessionByTokenAnyAccount(
  token: string,
  sessionType: WebSessionType,
): Promise<WebUserSessionRecord | null> {
  const row = await db('web_user_sessions')
    .where({
      token,
      session_type: sessionType,
    })
    .whereNull('revoked_at')
    .where('expires_at', '>', db.fn.now())
    .orderBy('id', 'desc')
    .first<WebUserSessionRecord>();

  return row ?? null;
}

export async function revokeWebUserSessionByToken(accountId: number, token: string): Promise<void> {
  await db('web_user_sessions')
    .where({ account_id: accountId, token })
    .whereNull('revoked_at')
    .update({
      revoked_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}

export async function deleteWebUserSessionByToken(accountId: number, token: string): Promise<void> {
  await db('web_user_sessions')
    .where({ account_id: accountId, token })
    .del();
}

export async function revokeWebUserSessionByTokenAnyAccount(token: string): Promise<void> {
  await db('web_user_sessions')
    .where({ token })
    .whereNull('revoked_at')
    .update({
      revoked_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}

export async function deleteWebUserSessionByTokenAnyAccount(token: string): Promise<void> {
  await db('web_user_sessions')
    .where({ token })
    .del();
}
