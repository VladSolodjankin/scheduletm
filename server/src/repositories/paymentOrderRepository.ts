import crypto from 'node:crypto';
import { db } from '../db/knex.js';
import type { PaymentProviderId } from './accountPaymentRepository.js';

export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'duplicate' | 'mismatch';

export type PaymentOrderRecord = {
  id: number;
  account_id: number;
  appointment_id: number;
  provider: PaymentProviderId;
  provider_order_id: string | null;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  redirect_url: string | null;
  created_at: Date;
  paid_at: Date | null;
};

const LEASE_DURATION_MS = 5 * 60 * 1000;

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function findPendingOrderForAppointment(
  accountId: number,
  appointmentId: number,
): Promise<PaymentOrderRecord | null> {
  return (await db('payment_orders')
    .where({ account_id: accountId, appointment_id: appointmentId, status: 'pending' })
    .first<PaymentOrderRecord>()) ?? null;
}

export async function cancelOrder(orderId: number): Promise<void> {
  await db('payment_orders').where({ id: orderId, status: 'pending' }).update({ status: 'cancelled' });
}

export async function insertPendingOrder(input: {
  accountId: number;
  appointmentId: number;
  provider: PaymentProviderId;
  amount: number;
  currency: string;
}): Promise<PaymentOrderRecord> {
  const [row] = await db('payment_orders')
    .insert({
      account_id: input.accountId,
      appointment_id: input.appointmentId,
      provider: input.provider,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
    })
    .returning<PaymentOrderRecord[]>('*');
  return row;
}

export async function attachProviderOrder(orderId: number, providerOrderId: string, redirectUrl: string): Promise<void> {
  await db('payment_orders').where({ id: orderId }).update({ provider_order_id: providerOrderId, redirect_url: redirectUrl });
}

export async function findOrderByProviderOrderId(
  provider: PaymentProviderId,
  providerOrderId: string,
): Promise<PaymentOrderRecord | null> {
  return (await db('payment_orders')
    .where({ provider, provider_order_id: providerOrderId })
    .first<PaymentOrderRecord>()) ?? null;
}

export type SettleOutcome = 'paid' | 'duplicate' | 'mismatch' | 'failed' | 'cancelled' | 'ignored';

/**
 * Applies a verified provider outcome to our own order row in ONE transaction. The account always comes from
 * the order row, never from the webhook payload.
 */
export async function settleOrder(input: {
  provider: PaymentProviderId;
  providerOrderId: string;
  outcome: 'succeeded' | 'failed' | 'cancelled';
  amount: number | null;
  currency: string | null;
}): Promise<{ result: SettleOutcome; order: PaymentOrderRecord | null }> {
  return db.transaction(async (trx) => {
    const order = await trx('payment_orders')
      .where({ provider: input.provider, provider_order_id: input.providerOrderId })
      .forUpdate()
      .first<PaymentOrderRecord>();
    if (!order) {
      return { result: 'ignored' as const, order: null };
    }

    if (input.outcome !== 'succeeded') {
      if (order.status !== 'pending') {
        return { result: 'ignored' as const, order };
      }
      const status = input.outcome === 'failed' ? 'failed' : 'cancelled';
      await trx('payment_orders').where({ id: order.id }).update({ status });
      return { result: status, order };
    }

    if (order.status === 'paid' || order.status === 'duplicate') {
      return { result: 'duplicate' as const, order };
    }

    if (input.amount === null || input.currency === null
      || input.amount !== order.amount || input.currency.toUpperCase() !== order.currency.toUpperCase()) {
      await trx('payment_orders').where({ id: order.id }).update({ status: 'mismatch' });
      return { result: 'mismatch' as const, order };
    }

    const appointment = await trx('appointments')
      .where({ account_id: order.account_id, id: order.appointment_id })
      .forUpdate()
      .first<{ is_paid: boolean }>('is_paid');
    if (!appointment || appointment.is_paid) {
      await trx('payment_orders').where({ id: order.id }).update({ status: 'duplicate' });
      return { result: 'duplicate' as const, order };
    }

    await trx('payment_orders').where({ id: order.id }).update({ status: 'paid', paid_at: trx.fn.now() });
    await trx('appointments')
      .where({ account_id: order.account_id, id: order.appointment_id })
      .update({ is_paid: true, updated_at: trx.fn.now() });
    await trx('appointment_events').insert({
      account_id: order.account_id,
      appointment_id: order.appointment_id,
      action: 'payment-received',
      actor_web_user_id: null,
      metadata_json: JSON.stringify({ provider: order.provider, orderId: order.id }),
    });
    return { result: 'paid' as const, order };
  });
}

export type PaymentWebhookClaim =
  | { status: 'acquired'; processingToken: string }
  | { status: 'processed' }
  | { status: 'active' };

export async function beginProcessingPaymentWebhookEvent(
  provider: PaymentProviderId,
  eventId: string,
  now = new Date(),
): Promise<PaymentWebhookClaim> {
  const processingToken = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

  const reclaimed = await db('payment_webhook_events')
    .where({ provider, event_id: eventId, status: 'processing' })
    .where(function findExpiredLease() {
      this.whereNull('lease_expires_at').orWhere('lease_expires_at', '<=', now);
    })
    .update({ processing_token: processingToken, lease_expires_at: expiresAt, updated_at: now })
    .returning('event_id');
  if (reclaimed.length > 0) {
    return { status: 'acquired', processingToken };
  }

  const inserted = await db('payment_webhook_events')
    .insert({
      provider,
      event_id: eventId,
      status: 'processing',
      processing_token: processingToken,
      lease_expires_at: expiresAt,
      received_at: now,
      updated_at: now,
    })
    .onConflict(['provider', 'event_id'])
    .ignore()
    .returning('event_id');
  if (inserted.length > 0) {
    return { status: 'acquired', processingToken };
  }

  const existing = await db('payment_webhook_events')
    .where({ provider, event_id: eventId })
    .first<{ status: string }>('status');
  return existing?.status === 'processed' ? { status: 'processed' } : { status: 'active' };
}

export async function markProcessedPaymentWebhookEvent(
  provider: PaymentProviderId,
  eventId: string,
  processingToken: string,
): Promise<boolean> {
  const updated = await db('payment_webhook_events')
    .where({ provider, event_id: eventId, status: 'processing', processing_token: processingToken })
    .update({ status: 'processed', processing_token: null, lease_expires_at: null, updated_at: db.fn.now() });
  return updated > 0;
}

export async function releaseProcessingPaymentWebhookEvent(
  provider: PaymentProviderId,
  eventId: string,
  processingToken: string,
): Promise<boolean> {
  const deleted = await db('payment_webhook_events')
    .where({ provider, event_id: eventId, status: 'processing', processing_token: processingToken })
    .del();
  return deleted > 0;
}
