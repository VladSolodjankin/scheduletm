import { db } from '../db/knex';

export async function findActiveTelegramBotTokenByAccountId(accountId: number): Promise<string | null> {
  const row = await db('web_users')
    .where({ account_id: accountId, is_active: true })
    .whereNotNull('telegram_bot_token')
    .orderByRaw(
      "CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'specialist' THEN 2 ELSE 3 END",
    )
    .orderBy('updated_at', 'desc')
    .first<{ telegram_bot_token: string | null }>('telegram_bot_token');

  return row?.telegram_bot_token ?? null;
}
