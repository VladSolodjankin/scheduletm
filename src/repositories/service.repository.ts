import { db } from '../db/knex';

export async function findActiveServices() {
  return db('services')
    .where({ is_active: true })
    .orderBy('id', 'asc');
}
