import { db } from '../db/knex.js';

const DEFAULT_ACCOUNT_CODE = 'default';

export async function getDefaultAccountId(): Promise<number> {
  const account = await db('accounts')
    .where({ code: DEFAULT_ACCOUNT_CODE, is_active: true })
    .first<{ id: number }>('id');

  if (!account) {
    throw new Error(`Аккаунт с code="${DEFAULT_ACCOUNT_CODE}" не найден`);
  }

  return account.id;
}
