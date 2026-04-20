import { db } from '../db/knex';

export async function linkTelegramUserToWebUser(
  accountId: number,
  telegramUserId: number,
  webUserId: number,
) {
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
