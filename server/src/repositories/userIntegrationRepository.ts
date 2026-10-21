import { db } from '../db/knex.js';

export type UserIntegrationRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  telegram_bot_token: string | null;
  telegram_bot_username: string | null;
  telegram_bot_name: string | null;
};

async function upsertPatch(accountId: number, webUserId: number, patch: Record<string, unknown>): Promise<void> {
  await db('user_integrations')
    .insert({
      account_id: accountId,
      web_user_id: webUserId,
      ...patch,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id', 'web_user_id'])
    .merge({
      ...patch,
      updated_at: db.fn.now(),
    });
}

export async function findUserIntegrationByWebUserId(
  accountId: number,
  webUserId: number,
): Promise<UserIntegrationRecord | null> {
  const row = await db('user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .first<UserIntegrationRecord>();

  return row ?? null;
}
