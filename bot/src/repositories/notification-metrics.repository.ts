import { db } from '../db/knex';

export async function countFailedNotifications() {
  const row = await db('notifications')
    .where({ status: 'failed' })
    .count<{ count: string }[]>({ count: '*' })
    .first();

  return Number(row?.count ?? 0);
}
