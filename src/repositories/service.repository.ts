import { db } from '../db/knex';

export async function findActiveServices() {
  return db('services')
    .where({ is_active: true })
    .orderBy('id', 'asc');
}

export async function findServiceById(id: number) {
  return db('services').where({ id }).first();
}
