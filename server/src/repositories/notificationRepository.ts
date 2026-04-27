import { db } from '../db/knex.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [5, 15, 30] as const;

function computeNextRetryAt(now: Date, attemptNo: number): Date {
  const backoffMinutes = RETRY_BACKOFF_MINUTES[Math.min(attemptNo - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(now.getTime() + backoffMinutes * 60 * 1000);
}

export async function hasSentNotification(
  appointmentId: number,
  type: string,
  channel: 'email',
): Promise<boolean> {
  const row = await db('notifications')
    .where({
      appointment_id: appointmentId,
      type,
      channel,
      status: 'sent',
    })
    .first<{ id: number }>('id');

  return Boolean(row?.id);
}

export async function upsertNotificationJob(input: {
  accountId: number;
  appointmentId: number;
  userId: number;
  type: string;
  channel: 'email';
  sendAt: Date;
  recipientEmail: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<{ id: number; status: string; attempts: number; max_attempts: number }> {
  const [row] = await db('notifications')
    .insert({
      account_id: input.accountId,
      user_id: input.userId,
      appointment_id: input.appointmentId,
      type: input.type,
      channel: input.channel,
      status: 'pending',
      send_at: input.sendAt,
      next_retry_at: input.sendAt,
      recipient_email: input.recipientEmail,
      payload_json: JSON.stringify(input.payload ?? {}),
      attempts: 0,
      max_attempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['appointment_id', 'type', 'channel'])
    .ignore()
    .returning<{ id: number; status: string; attempts: number; max_attempts: number }[]>(
      ['id', 'status', 'attempts', 'max_attempts'],
    );

  if (row) {
    return row;
  }

  const existing = await db('notifications')
    .where({
      appointment_id: input.appointmentId,
      type: input.type,
      channel: input.channel,
    })
    .first<{ id: number; status: string; attempts: number; max_attempts: number }>(
      ['id', 'status', 'attempts', 'max_attempts'],
    );

  if (!existing) {
    throw new Error('Notification job upsert failed');
  }

  return existing;
}

export async function claimNotificationForDelivery(input: {
  notificationId: number;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const updated = await db('notifications')
    .where('id', input.notificationId)
    .whereIn('status', ['pending', 'retry'])
    .where('attempts', '<', db.ref('max_attempts'))
    .andWhere((builder) => {
      builder.whereNull('next_retry_at').orWhere('next_retry_at', '<=', now);
    })
    .update({
      status: 'processing',
      updated_at: db.fn.now(),
    });

  return updated > 0;
}

export async function markNotificationSent(input: {
  notificationId: number;
  recipientEmail: string;
  sentAt?: Date;
}): Promise<void> {
  await db('notifications')
    .where('id', input.notificationId)
    .update({
      status: 'sent',
      sent_at: input.sentAt ?? db.fn.now(),
      recipient_email: input.recipientEmail,
      last_error: null,
      next_retry_at: null,
      updated_at: db.fn.now(),
    });
}

export async function markNotificationDeliveryFailure(input: {
  notificationId: number;
  error: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const current = await db('notifications')
    .where('id', input.notificationId)
    .first<{ attempts: number; max_attempts: number }>(['attempts', 'max_attempts']);

  if (!current) {
    return;
  }

  const nextAttempts = current.attempts + 1;
  const exhausted = nextAttempts >= current.max_attempts;

  await db('notifications')
    .where('id', input.notificationId)
    .update({
      attempts: nextAttempts,
      status: exhausted ? 'failed' : 'retry',
      last_error: input.error,
      next_retry_at: exhausted ? null : computeNextRetryAt(now, nextAttempts),
      updated_at: db.fn.now(),
    });
}

export async function insertSentNotification(input: {
  accountId: number;
  appointmentId: number;
  userId: number;
  type: string;
  channel: 'email';
  sendAt: Date;
  recipientEmail: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await upsertNotificationJob({
    accountId: input.accountId,
    appointmentId: input.appointmentId,
    userId: input.userId,
    type: input.type,
    channel: input.channel,
    sendAt: input.sendAt,
    recipientEmail: input.recipientEmail,
    payload: input.payload,
    maxAttempts: 1,
  });

  const record = await db('notifications')
    .where({
      appointment_id: input.appointmentId,
      type: input.type,
      channel: input.channel,
    })
    .first<{ id: number }>('id');

  if (!record) {
    return;
  }

  await db('notifications')
    .where('id', record.id)
    .update({
      attempts: 1,
      status: 'sent',
      sent_at: db.fn.now(),
      recipient_email: input.recipientEmail,
      next_retry_at: null,
      updated_at: db.fn.now(),
    });
}
