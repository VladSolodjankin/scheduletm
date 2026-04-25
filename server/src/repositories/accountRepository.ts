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

export async function createAccount(input: { code: string; name: string }): Promise<number> {
  const [row] = await db('accounts')
    .insert({
      code: input.code,
      name: input.name,
      is_active: true,
    })
    .returning<{ id: number }[]>('id');

  return row.id;
}

export async function findAccountById(id: number): Promise<{ id: number; name: string } | null> {
  const account = await db('accounts')
    .where({ id })
    .first<{ id: number; name: string }>('id', 'name');

  return account ?? null;
}
