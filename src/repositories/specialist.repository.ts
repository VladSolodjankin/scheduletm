import { db } from '../db/knex';

export async function findActiveSpecialists() {
  return db('specialists')
    .where({ is_active: true })
    .orderBy('id', 'asc');
}
