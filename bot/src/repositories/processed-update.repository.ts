import { randomUUID } from 'node:crypto';
import { db } from '../db/knex';

const LEASE_DURATION_MS = 5 * 60 * 1000;
const PROCESSED_UPDATE_RETENTION_DAYS = 30;

function leaseExpiresAt(now: Date): Date {
  return new Date(now.getTime() + LEASE_DURATION_MS);
}

export type UpdateProcessingClaim =
  | { status: 'acquired'; processingToken: string }
  | { status: 'processed' }
  | { status: 'active' };

export async function beginProcessingUpdate(
  updateId: number,
  now = new Date(),
): Promise<UpdateProcessingClaim> {
  const processingToken = randomUUID();
  const expiresAt = leaseExpiresAt(now);

  const reclaimed = await db('processed_updates')
    .where({
      update_id: String(updateId),
      status: 'processing',
    })
    .where(function findExpiredOrLegacyLease() {
      this.whereNull('lease_expires_at').orWhere('lease_expires_at', '<=', now);
    })
    .update({
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      updated_at: now,
    })
    .returning('update_id');

  if (reclaimed.length > 0) {
    return { status: 'acquired', processingToken };
  }

  const inserted = await db('processed_updates')
    .insert({
      update_id: String(updateId),
      status: 'processing',
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    })
    .onConflict('update_id')
    .ignore()
    .returning('update_id');

  if (inserted.length > 0) {
    return { status: 'acquired', processingToken };
  }

  const existing = await db('processed_updates')
    .where({ update_id: String(updateId) })
    .first<{ status: string }>('status');

  return existing?.status === 'processed'
    ? { status: 'processed' }
    : { status: 'active' };
}

export async function markProcessedUpdate(updateId: number, processingToken: string): Promise<boolean> {
  const updated = await db('processed_updates')
    .where({
      update_id: String(updateId),
      status: 'processing',
      processing_token: processingToken,
    })
    .update({
      status: 'processed',
      processing_token: null,
      lease_expires_at: null,
      updated_at: db.fn.now(),
    });

  return updated > 0;
}

export async function releaseProcessingUpdate(updateId: number, processingToken: string): Promise<boolean> {
  const deleted = await db('processed_updates')
    .where({
      update_id: String(updateId),
      status: 'processing',
      processing_token: processingToken,
    })
    .del();

  return deleted > 0;
}

export async function acquireTelegramUserLease(
  telegramUserId: number,
  now = new Date(),
): Promise<string | null> {
  const processingToken = randomUUID();
  const expiresAt = leaseExpiresAt(now);

  const reclaimed = await db('telegram_user_processing_leases')
    .where({ telegram_user_id: String(telegramUserId) })
    .where('lease_expires_at', '<=', now)
    .update({
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      updated_at: now,
    })
    .returning('telegram_user_id');

  if (reclaimed.length > 0) {
    return processingToken;
  }

  const inserted = await db('telegram_user_processing_leases')
    .insert({
      telegram_user_id: String(telegramUserId),
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    })
    .onConflict('telegram_user_id')
    .ignore()
    .returning('telegram_user_id');

  return inserted.length > 0 ? processingToken : null;
}

export async function releaseTelegramUserLease(
  telegramUserId: number,
  processingToken: string,
): Promise<boolean> {
  const deleted = await db('telegram_user_processing_leases')
    .where({
      telegram_user_id: String(telegramUserId),
      processing_token: processingToken,
    })
    .del();

  return deleted > 0;
}

export async function cleanupProcessedUpdates(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - PROCESSED_UPDATE_RETENTION_DAYS);

  return db('processed_updates')
    .where({ status: 'processed' })
    .where('updated_at', '<', cutoff)
    .del();
}
