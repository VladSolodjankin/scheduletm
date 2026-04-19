import { db } from '../db/knex';

export async function findActiveServices(accountId: number) {
  return db('services')
    .where({ account_id: accountId, is_active: true })
    .orderBy('id', 'asc');
}

export async function findServiceById(accountId: number, id: number) {
  return db('services').where({ account_id: accountId, id }).first();
}
