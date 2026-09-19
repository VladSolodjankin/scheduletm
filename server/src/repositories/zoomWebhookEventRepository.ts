import crypto from 'node:crypto';
import { db } from '../db/knex.js';

const LEASE_DURATION_MS = 5 * 60 * 1000;

export type ZoomWebhookClaim =
  | { status: 'acquired'; processingToken: string }
  | { status: 'processed' }
  | { status: 'active' };

// Structural idempotency pattern mirrors bot/src/repositories/processed-update.repository.ts
// (lease-based claim so a retried delivery during in-flight processing doesn't double-run),
// kept as its own server-owned table rather than reusing the bot's table directly.
export async function beginProcessingZoomWebhookEvent(
  eventId: string,
  now = new Date(),
): Promise<ZoomWebhookClaim> {
  const processingToken = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

  const reclaimed = await db('zoom_webhook_events')
    .where({ event_id: eventId, status: 'processing' })
    .where(function findExpiredOrLegacyLease() {
      this.whereNull('lease_expires_at').orWhere('lease_expires_at', '<=', now);
    })
    .update({
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      updated_at: now,
    })
    .returning('event_id');

  if (reclaimed.length > 0) {
    return { status: 'acquired', processingToken };
  }

  const inserted = await db('zoom_webhook_events')
    .insert({
      event_id: eventId,
      status: 'processing',
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    })
    .onConflict('event_id')
    .ignore()
    .returning('event_id');

  if (inserted.length > 0) {
    return { status: 'acquired', processingToken };
  }

  const existing = await db('zoom_webhook_events')
    .where({ event_id: eventId })
    .first<{ status: string }>('status');

  return existing?.status === 'processed' ? { status: 'processed' } : { status: 'active' };
}

export async function markProcessedZoomWebhookEvent(eventId: string, processingToken: string): Promise<boolean> {
  const updated = await db('zoom_webhook_events')
    .where({ event_id: eventId, status: 'processing', processing_token: processingToken })
    .update({
      status: 'processed',
      processing_token: null,
      lease_expires_at: null,
      updated_at: db.fn.now(),
    });

  return updated > 0;
}

export async function releaseProcessingZoomWebhookEvent(eventId: string, processingToken: string): Promise<boolean> {
  const deleted = await db('zoom_webhook_events')
    .where({ event_id: eventId, status: 'processing', processing_token: processingToken })
    .del();

  return deleted > 0;
}
