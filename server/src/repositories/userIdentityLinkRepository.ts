import { db } from '../db/knex.js';

type TelegramUserRow = {
  id: number;
  account_id: number;
  email: string | null;
};

export async function findTelegramUserByEmail(
  accountId: number,
  email: string,
): Promise<TelegramUserRow | null> {
  const row = await db('users')
    .where({ account_id: accountId, email })
    .first<TelegramUserRow>();

  return row ?? null;
}

export async function createIdentityLinkIfMissing(
  accountId: number,
  telegramUserId: number,
  webUserId: number,
): Promise<void> {
  const existing = await db('user_identity_links')
    .where({ account_id: accountId })
    .andWhere((queryBuilder) => {
      queryBuilder.where({ telegram_user_id: telegramUserId }).orWhere({ web_user_id: webUserId });
    })
    .first('id');

  if (existing) {
    return;
  }

  await db('user_identity_links')
    .insert({
      account_id: accountId,
      telegram_user_id: telegramUserId,
      web_user_id: webUserId,
      link_source: 'email-match',
    });
}
