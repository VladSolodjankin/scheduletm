import { db } from '../db/knex';

export async function findWebUserByEmail(accountId: number, email: string) {
  return db('web_users')
    .where({ account_id: accountId, email })
    .first();
}
