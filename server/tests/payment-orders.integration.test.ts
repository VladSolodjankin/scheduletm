import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/knex.js';
import { createAccount } from '../src/repositories/accountRepository.js';
import {
  findAccountPaymentSettings,
  findResolvedServicePrice,
  setActivePaymentProvider,
  upsertAccountPaymentProvider,
  upsertManualPaymentSettings,
  activatePaymentProviderIfNoneActive,
} from '../src/repositories/accountPaymentRepository.js';
import { createAppointment, ensureFallbackServiceForAccount, updateAppointment } from '../src/repositories/appointmentRepository.js';
import { createClient } from '../src/repositories/clientRepository.js';
import {
  attachProviderOrder,
  beginProcessingPaymentWebhookEvent,
  insertPendingOrder,
  isUniqueViolation,
  markProcessedPaymentWebhookEvent,
  settleOrder,
} from '../src/repositories/paymentOrderRepository.js';
import { consumeStripeOAuthState, createAppointmentPaymentToken, createStripeOAuthState, findAppointmentPaymentToken } from '../src/repositories/paymentTokenRepository.js';
import { createSpecialist } from '../src/repositories/specialistRepository.js';

const createdAccountIds: number[] = [];

afterAll(async () => {
  if (createdAccountIds.length) {
    await db('accounts').whereIn('id', createdAccountIds).delete();
  }
  await db.destroy();
});

async function createAppointmentFixture(price = 1500, currency = 'RUB') {
  const scope = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const accountId = await createAccount({ code: `pay-${scope}`, name: `Payments ${scope}` });
  createdAccountIds.push(accountId);
  const specialistId = await createSpecialist({ accountId, name: 'Spec', code: `spec-${scope}`, userId: null });
  const client = await createClient({ accountId, firstName: 'C', lastName: 'L', email: `c-${scope}@example.com` });
  const serviceId = await ensureFallbackServiceForAccount(accountId);
  const appointment = await createAppointment({
    accountId,
    specialistId,
    scheduledAt: new Date(Date.now() + 48 * 3600_000),
    status: 'new',
    notes: null,
    userId: client.id,
    serviceId,
    durationMin: 60,
    price,
    currency,
  });
  return { accountId, appointment, serviceId, specialistId };
}

describe('payment orders (database)', () => {
  it('marks the appointment paid once, writes a payment-received audit event and treats a replay as duplicate', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    const order = await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'yookassa', amount: 1500, currency: 'RUB' });
    await attachProviderOrder(order.id, `yk-${order.id}`, 'https://pay.example/redirect');

    const first = await settleOrder({ provider: 'yookassa', providerOrderId: `yk-${order.id}`, outcome: 'succeeded', amount: 1500, currency: 'RUB' });
    expect(first.result).toBe('paid');

    const stored = await db('appointments').where({ id: appointment.id }).first();
    expect(stored.is_paid).toBe(true);
    const events = await db('appointment_events').where({ appointment_id: appointment.id, action: 'payment-received' });
    expect(events).toHaveLength(1);
    expect(events[0].actor_web_user_id).toBeNull();
    expect(JSON.parse(events[0].metadata_json)).toMatchObject({ provider: 'yookassa' });

    const replay = await settleOrder({ provider: 'yookassa', providerOrderId: `yk-${order.id}`, outcome: 'succeeded', amount: 1500, currency: 'RUB' });
    expect(replay.result).toBe('duplicate');
    expect(await db('appointment_events').where({ appointment_id: appointment.id, action: 'payment-received' })).toHaveLength(1);
  });

  it('manual mark-paid cancels pending checkouts so a later online payment is recorded as duplicate', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    const order = await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'bog', amount: 1500, currency: 'GEL' });
    await attachProviderOrder(order.id, `bog-m-${order.id}`, 'https://pay.example/redirect');

    await updateAppointment({ accountId, id: appointment.id, isPaid: true });
    expect((await db('payment_orders').where({ id: order.id }).first()).status).toBe('cancelled');

    const late = await settleOrder({ provider: 'bog', providerOrderId: `bog-m-${order.id}`, outcome: 'succeeded', amount: 1500, currency: 'GEL' });
    expect(late.result).toBe('duplicate');
    expect((await db('payment_orders').where({ id: order.id }).first()).status).toBe('duplicate');
    expect(await db('appointment_events').where({ appointment_id: appointment.id, action: 'payment-received' })).toHaveLength(0);
  });

  it('rejects non-positive order amounts at the database level', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    await expect(insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'bog', amount: 0, currency: 'GEL' })).rejects.toThrow();
  });

  it('does not mark paid on an amount or currency mismatch', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    const order = await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'bog', amount: 1500, currency: 'GEL' });
    await attachProviderOrder(order.id, `bog-${order.id}`, 'https://pay.example/redirect');

    expect((await settleOrder({ provider: 'bog', providerOrderId: `bog-${order.id}`, outcome: 'succeeded', amount: 10, currency: 'GEL' })).result).toBe('mismatch');
    expect((await db('payment_orders').where({ id: order.id }).first()).status).toBe('mismatch');
    expect((await db('appointments').where({ id: appointment.id }).first()).is_paid).toBe(false);
  });

  it('marks a late webhook as duplicate when the appointment was already paid manually', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    const order = await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'stripe', amount: 1500, currency: 'USD' });
    await attachProviderOrder(order.id, `cs_${order.id}`, 'https://pay.example/redirect');
    await db('appointments').where({ id: appointment.id }).update({ is_paid: true });

    const result = await settleOrder({ provider: 'stripe', providerOrderId: `cs_${order.id}`, outcome: 'succeeded', amount: 1500, currency: 'USD' });
    expect(result.result).toBe('duplicate');
    expect((await db('payment_orders').where({ id: order.id }).first()).status).toBe('duplicate');
    expect(await db('appointment_events').where({ appointment_id: appointment.id, action: 'payment-received' })).toHaveLength(0);
  });

  it('ignores unknown provider orders and cancels pending ones on failure events', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    expect((await settleOrder({ provider: 'bog', providerOrderId: 'does-not-exist', outcome: 'succeeded', amount: 1, currency: 'GEL' })).result).toBe('ignored');

    const order = await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'bog', amount: 1500, currency: 'GEL' });
    await attachProviderOrder(order.id, `bog-f-${order.id}`, 'https://pay.example/redirect');
    expect((await settleOrder({ provider: 'bog', providerOrderId: `bog-f-${order.id}`, outcome: 'failed', amount: null, currency: null })).result).toBe('failed');
  });

  it('allows only one pending order per appointment', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'bog', amount: 1500, currency: 'GEL' });
    let violation: unknown;
    try {
      await insertPendingOrder({ accountId, appointmentId: appointment.id, provider: 'bog', amount: 1500, currency: 'GEL' });
    } catch (error) {
      violation = error;
    }
    expect(isUniqueViolation(violation)).toBe(true);
  });

  it('claims a webhook event once and reports processed replays', async () => {
    const eventId = `evt-${Date.now()}-${Math.random()}`;
    const first = await beginProcessingPaymentWebhookEvent('stripe', eventId);
    expect(first.status).toBe('acquired');
    expect((await beginProcessingPaymentWebhookEvent('stripe', eventId)).status).toBe('active');
    if (first.status === 'acquired') {
      await markProcessedPaymentWebhookEvent('stripe', eventId, first.processingToken);
    }
    expect((await beginProcessingPaymentWebhookEvent('stripe', eventId)).status).toBe('processed');
    await db('payment_webhook_events').where({ event_id: eventId }).delete();
  });

  it('stores payment link tokens hashed and single-use Stripe OAuth states', async () => {
    const { accountId, appointment } = await createAppointmentFixture();
    const token = await createAppointmentPaymentToken(appointment.id, new Date(Date.now() + 3600_000));
    expect((await findAppointmentPaymentToken(token))?.appointment_id).toBe(appointment.id);
    const rows = await db('appointment_payment_tokens').where({ appointment_id: appointment.id });
    expect(rows[0].token_hash).not.toContain(token);
    expect(await findAppointmentPaymentToken('wrong')).toBeNull();

    const webUser = await db('web_users').where({ account_id: accountId }).first('id');
    if (webUser) {
      await createStripeOAuthState({ accountId, webUserId: webUser.id, stateToken: `st-${accountId}`, expiresAt: new Date(Date.now() + 60_000) });
      expect(await consumeStripeOAuthState(`st-${accountId}`)).not.toBeNull();
      expect(await consumeStripeOAuthState(`st-${accountId}`)).toBeNull();
    }
  });

  it('keeps the first connected provider active and never replaces an existing active one', async () => {
    const { accountId } = await createAppointmentFixture();
    await upsertManualPaymentSettings(accountId, {
      bankTransfer: { enabled: true, text: 'IBAN 1' },
      customLink: { enabled: false, title: '', url: '' },
      cash: { enabled: false, comment: '' },
    });
    await upsertAccountPaymentProvider({ accountId, provider: 'bog', config: { clientId: 'c' }, secretEncrypted: 'x', webhookTokenHash: 'h' });
    await activatePaymentProviderIfNoneActive(accountId, 'bog');
    expect((await findAccountPaymentSettings(accountId))?.active_provider).toBe('bog');
    await activatePaymentProviderIfNoneActive(accountId, 'yookassa');
    expect((await findAccountPaymentSettings(accountId))?.active_provider).toBe('bog');
    await setActivePaymentProvider(accountId, null);
    expect((await findAccountPaymentSettings(accountId))?.active_provider).toBeNull();
    expect((await findAccountPaymentSettings(accountId))?.bank_transfer_text).toBe('IBAN 1');
  });

  it('resolves the service price with the specialist override', async () => {
    const { accountId, serviceId, specialistId } = await createAppointmentFixture();
    await db('services').where({ id: serviceId }).update({ price: 100, currency: 'GEL' });
    expect(await findResolvedServicePrice(accountId, serviceId, specialistId)).toEqual({ price: 100, currency: 'GEL' });
    await db('specialist_services').insert({ account_id: accountId, service_id: serviceId, specialist_id: specialistId, price_override: 250, is_active: true });
    expect(await findResolvedServicePrice(accountId, serviceId, specialistId)).toEqual({ price: 250, currency: 'GEL' });
  });
});
