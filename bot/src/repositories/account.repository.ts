import { db } from '../db/knex';

export const DEFAULT_ACCOUNT_CODE = 'default';

export async function getDefaultAccountId() {
  const account = await db('accounts')
    .select('id')
    .where({ code: DEFAULT_ACCOUNT_CODE })
    .first<{ id: number }>();

  if (!account) {
    throw new Error(`Default account "${DEFAULT_ACCOUNT_CODE}" was not found`);
  }

  return account.id;
}
