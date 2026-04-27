import { db } from '../db/knex.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [5, 15, 30] as const;

export type NotificationLogRecord = {
  id: number;
  account_id: number;
  user_id: number;
  appointment_id: number;
  specialist_id: number;
  type: string;
  channel: string;
  status: string;
  attempts: number;
  max_attempts: number;
  recipient_email: string | null;
  recipient_chat_id: string | null;
  payload_json: Record<string, unknown> | null;
  last_error: string | null;
  send_at: Date;
  next_retry_at: Date | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
  specialist_name: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_username: string | null;
  client_email: string | null;
};

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

export async function listNotificationLogs(filters: {
  accountId?: number;
  specialistId?: number;
  userId?: number;
  limit?: number;
}): Promise<NotificationLogRecord[]> {
  const query = db('notifications as n')
    .join('appointments as a', function joinAppointments() {
      this.on('a.id', '=', 'n.appointment_id').andOn('a.account_id', '=', 'n.account_id');
    })
    .leftJoin('specialists as s', function joinSpecialists() {
      this.on('s.id', '=', 'a.specialist_id').andOn('s.account_id', '=', 'a.account_id');
    })
    .leftJoin('clients as c', function joinClients() {
      this.on('c.id', '=', 'n.user_id').andOn('c.account_id', '=', 'n.account_id');
    })
    .orderBy('n.created_at', 'desc')
    .limit(filters.limit ?? 300);

  if (filters.accountId !== undefined) {
    query.where('n.account_id', filters.accountId);
  }

  if (filters.specialistId !== undefined) {
    query.where('a.specialist_id', filters.specialistId);
  }

  if (filters.userId !== undefined) {
    query.where('n.user_id', filters.userId);
  }

  return query.select<NotificationLogRecord[]>(
    'n.id',
    'n.account_id',
    'n.user_id',
    'n.appointment_id',
    'a.specialist_id',
    'n.type',
    'n.channel',
    'n.status',
    'n.attempts',
    'n.max_attempts',
    'n.recipient_email',
    'n.recipient_chat_id',
    'n.payload_json',
    'n.last_error',
    'n.send_at',
    'n.next_retry_at',
    'n.sent_at',
    'n.created_at',
    'n.updated_at',
    's.name as specialist_name',
    'c.first_name as client_first_name',
    'c.last_name as client_last_name',
    'c.username as client_username',
    'c.email as client_email',
  );
}

export async function findNotificationLogById(notificationId: number): Promise<NotificationLogRecord | null> {
  const row = await db('notifications as n')
    .join('appointments as a', function joinAppointments() {
      this.on('a.id', '=', 'n.appointment_id').andOn('a.account_id', '=', 'n.account_id');
    })
    .leftJoin('specialists as s', function joinSpecialists() {
      this.on('s.id', '=', 'a.specialist_id').andOn('s.account_id', '=', 'a.account_id');
    })
    .leftJoin('clients as c', function joinClients() {
      this.on('c.id', '=', 'n.user_id').andOn('c.account_id', '=', 'n.account_id');
    })
    .where('n.id', notificationId)
    .first<NotificationLogRecord>(
      'n.id',
      'n.account_id',
      'n.user_id',
      'n.appointment_id',
      'a.specialist_id',
      'n.type',
      'n.channel',
      'n.status',
      'n.attempts',
      'n.max_attempts',
      'n.recipient_email',
      'n.recipient_chat_id',
      'n.payload_json',
      'n.last_error',
      'n.send_at',
      'n.next_retry_at',
      'n.sent_at',
      'n.created_at',
      'n.updated_at',
      's.name as specialist_name',
      'c.first_name as client_first_name',
      'c.last_name as client_last_name',
      'c.username as client_username',
      'c.email as client_email',
    );

  return row ?? null;
}

export async function resetNotificationForResend(input: {
  notificationId: number;
  accountId?: number;
  specialistId?: number;
}): Promise<boolean> {
  const query = db('notifications as n')
    .join('appointments as a', function joinAppointments() {
      this.on('a.id', '=', 'n.appointment_id').andOn('a.account_id', '=', 'n.account_id');
    })
    .where('n.id', input.notificationId)
    .whereIn('n.status', ['failed', 'retry', 'cancelled']);

  if (input.accountId !== undefined) {
    query.andWhere('n.account_id', input.accountId);
  }

  if (input.specialistId !== undefined) {
    query.andWhere('a.specialist_id', input.specialistId);
  }

  const updated = await query.update({
    status: 'pending',
    attempts: 0,
    last_error: null,
    next_retry_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  return updated > 0;
}
