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

export async function findAccountById(id: number): Promise<{ id: number; name: string; delete_scheduled_at: Date | null } | null> {
  const account = await db('accounts')
    .where({ id })
    .first<{ id: number; name: string; delete_scheduled_at: Date | null }>('id', 'name', 'delete_scheduled_at');

  return account ?? null;
}

export async function scheduleAccountDeletion(id: number, deleteScheduledAt: Date): Promise<void> {
  await db('accounts').where({ id }).update({ delete_scheduled_at: deleteScheduledAt });
}

export async function cancelAccountDeletion(id: number): Promise<void> {
  await db('accounts').where({ id }).update({ delete_scheduled_at: null });
}

export async function listActiveAccounts(): Promise<Array<{ id: number; name: string }>> {
  return db('accounts')
    .where({ is_active: true })
    .orderBy('name', 'asc')
    .select<Array<{ id: number; name: string }>>('id', 'name');
}

export async function listAccountsDueForDeletion(now: Date): Promise<Array<{ id: number }>> {
  return db('accounts')
    .whereNotNull('delete_scheduled_at')
    .andWhere('delete_scheduled_at', '<=', now)
    .select<Array<{ id: number }>>('id');
}

export async function deleteAccountById(id: number): Promise<void> {
  await db('accounts')
    .where({ id })
    .delete();
}
