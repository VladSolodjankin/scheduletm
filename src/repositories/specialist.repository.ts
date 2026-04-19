import { db } from '../db/knex';

export async function findActiveSpecialists(accountId: number) {
  return db('specialists')
    .where({ account_id: accountId, is_active: true })
    .orderBy([{ column: 'is_default', order: 'desc' }, { column: 'id', order: 'asc' }]);
}

export async function findSpecialistById(accountId: number, id: number) {
  return db('specialists').where({ account_id: accountId, id }).first();
}

export async function findSingleDefaultActiveSpecialist(accountId: number) {
  const specialists = await db('specialists')
    .where({ account_id: accountId, is_active: true, is_default: true })
    .orderBy('id', 'asc');

  if (specialists.length === 1) {
    const activeCount = await db('specialists')
      .where({ account_id: accountId, is_active: true })
      .count<{ count: string }>('id as count')
      .first();

    if (Number(activeCount?.count ?? 0) === 1) {
      return specialists[0];
    }
  }

  return null;
}
