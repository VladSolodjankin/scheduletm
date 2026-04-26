import { db } from '../db/knex.js';

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
  await db('notifications').insert({
    account_id: input.accountId,
    user_id: input.userId,
    appointment_id: input.appointmentId,
    type: input.type,
    channel: input.channel,
    status: 'sent',
    send_at: input.sendAt,
    sent_at: db.fn.now(),
    recipient_email: input.recipientEmail,
    payload_json: JSON.stringify(input.payload ?? {}),
    attempts: 1,
    max_attempts: 1,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
}
