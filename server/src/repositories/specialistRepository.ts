import { db } from '../db/knex.js';

export async function createDefaultSpecialistForWebUserIfMissing(
  accountId: number,
  webUserId: number,
  email: string,
): Promise<void> {
  const existing = await db('specialists')
    .where({ account_id: accountId, web_user_id: webUserId })
    .first('id');

  if (existing) {
    return;
  }

  const fallbackName = email.split('@')[0]?.trim() || `Owner ${webUserId}`;

  await db('specialists').insert({
    account_id: accountId,
    code: `owner-${webUserId}`,
    name: fallbackName,
    is_active: true,
    is_default: true,
    web_user_id: webUserId,
  });
}
