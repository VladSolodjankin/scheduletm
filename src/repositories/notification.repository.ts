import { db } from '../db/knex';

export type NotificationChannel = 'telegram' | 'email' | 'sms';
export type NotificationStatus = 'pending' | 'retry' | 'sent' | 'failed' | 'cancelled';

type NotificationRow = {
  id: number;
  account_id: number;
  appointment_id: number;
  user_id: number;
  type: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  send_at: string | Date;
  sent_at: string | Date | null;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | Date | null;
  payload_json: Record<string, unknown>;
  recipient_chat_id: string | number | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  last_error: string | null;
};

export type NotificationRecipient = {
  chatId?: number;
  email?: string;
  phone?: string;
};

type CreateNotificationInput = {
  accountId: number;
  appointmentId: number;
  userId: number;
  type: string;
  channel: NotificationChannel;
  sendAt: string;
  payload: Record<string, unknown>;
  recipient: NotificationRecipient;
  maxAttempts?: number;
};

export async function createNotification(input: CreateNotificationInput) {
  const [row] = await db('notifications')
    .insert({
      account_id: input.accountId,
      appointment_id: input.appointmentId,
      user_id: input.userId,
      type: input.type,
      channel: input.channel,
      status: 'pending',
      send_at: input.sendAt,
      attempts: 0,
      max_attempts: input.maxAttempts ?? 3,
      payload_json: input.payload,
      recipient_chat_id: input.recipient.chatId ?? null,
      recipient_email: input.recipient.email ?? null,
      recipient_phone: input.recipient.phone ?? null,
    })
    .returning('*');

  return row;
}

export async function findDueNotifications(limit = 100) {
  const nowIso = new Date().toISOString();

  const rows = (await db('notifications')
    .whereIn('status', ['pending', 'retry'])
    .where('send_at', '<=', nowIso)
    .andWhere((query) => {
      query.whereNull('next_retry_at').orWhere('next_retry_at', '<=', nowIso);
    })
    .orderBy('send_at', 'asc')
    .limit(limit)
    .select('*')) as NotificationRow[];

  return rows.map(mapNotificationRow);
}

export async function markNotificationSent(notificationId: number) {
  await db('notifications')
    .where({ id: notificationId })
    .update({
      status: 'sent',
      sent_at: db.fn.now(),
      updated_at: db.fn.now(),
      last_error: null,
      next_retry_at: null,
    });
}

export async function scheduleNotificationRetry(
  notificationId: number,
  attempts: number,
  nextRetryAtIso: string,
  lastError: string,
) {
  await db('notifications')
    .where({ id: notificationId })
    .update({
      status: 'retry',
      attempts,
      next_retry_at: nextRetryAtIso,
      last_error: lastError,
      updated_at: db.fn.now(),
    });
}

export async function markNotificationFailed(
  notificationId: number,
  attempts: number,
  lastError: string,
) {
  await db('notifications')
    .where({ id: notificationId })
    .update({
      status: 'failed',
      attempts,
      last_error: lastError,
      next_retry_at: null,
      updated_at: db.fn.now(),
    });
}



export async function cancelPendingNotificationsByAppointment(
  accountId: number,
  appointmentId: number,
) {
  return db('notifications')
    .where({ account_id: accountId, appointment_id: appointmentId })
    .whereIn('status', ['pending', 'retry'])
    .update({
      status: 'cancelled',
      next_retry_at: null,
      updated_at: db.fn.now(),
    });
}
function mapNotificationRow(row: NotificationRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    appointmentId: row.appointment_id,
    userId: row.user_id,
    type: row.type,
    channel: row.channel,
    status: row.status,
    sendAt: row.send_at,
    sentAt: row.sent_at,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextRetryAt: row.next_retry_at,
    payload: row.payload_json,
    recipientChatId:
      row.recipient_chat_id == null ? null : Number(row.recipient_chat_id),
    recipientEmail: row.recipient_email,
    recipientPhone: row.recipient_phone,
    lastError: row.last_error,
  };
}
