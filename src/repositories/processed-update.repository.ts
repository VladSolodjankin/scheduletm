import { db } from '../db/knex';

export async function beginProcessingUpdate(updateId: number) {
  const inserted = await db('processed_updates')
    .insert({
      update_id: String(updateId),
      status: 'processing',
    })
    .onConflict('update_id')
    .ignore()
    .returning('update_id');

  return inserted.length > 0;
}

export async function markProcessedUpdate(updateId: number) {
  await db('processed_updates')
    .where({ update_id: String(updateId) })
    .update({
      status: 'processed',
      updated_at: db.fn.now(),
    });
}

export async function releaseProcessingUpdate(updateId: number) {
  await db('processed_updates')
    .where({ update_id: String(updateId), status: 'processing' })
    .del();
}
