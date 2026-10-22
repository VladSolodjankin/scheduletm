import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { findAccountPaymentProvider } from '../repositories/accountPaymentRepository.js';
import { findAppointmentByIdAnyAccount, type AppointmentRecord } from '../repositories/appointmentRepository.js';
import {
  attachProviderOrder,
  cancelOrder,
  findPendingOrderForAppointment,
  insertPendingOrder,
  isUniqueViolation,
} from '../repositories/paymentOrderRepository.js';
import { findAppointmentPaymentToken } from '../repositories/paymentTokenRepository.js';
import { findService } from '../repositories/serviceRepository.js';
import { canPayOnline, resolveAppointmentAmount } from './paymentReminderService.js';
import {
  buildProviderCallbackUrl,
  loadAccountPaymentMethods,
  toProviderCredentials,
  type AccountPaymentMethods,
} from './paymentSettingsService.js';
import { getPaymentAdapter } from './payments/registry.js';
import { InvalidCredentialsError, ProviderUnreachableError } from './payments/types.js';

const PENDING_ORDER_REUSE_MS = 10 * 60 * 1000;
const PENDING_ORDER_CREATING_MS = 60 * 1000;

export class PaymentLinkNotFoundError extends Error {
  constructor() {
    super('PAYMENT_LINK_NOT_FOUND');
  }
}

export class PaymentLinkGoneError extends Error {
  constructor() {
    super('PAYMENT_LINK_GONE');
  }
}

export class PaymentUnavailableError extends Error {
  constructor() {
    super('PAYMENT_UNAVAILABLE');
  }
}

export { ProviderUnreachableError };

export type PublicPaymentView = {
  appointment: { serviceName: string; scheduledAt: string; amount: number; currency: string; isPaid: boolean };
  canPayOnline: boolean;
  manual: {
    bankTransfer: { text: string } | null;
    customLink: { title: string; url: string } | null;
    cash: { comment: string } | null;
  };
};

async function resolveLink(token: string): Promise<AppointmentRecord> {
  const record = await findAppointmentPaymentToken(token);
  if (!record) {
    throw new PaymentLinkNotFoundError();
  }
  const appointment = await findAppointmentByIdAnyAccount(record.appointment_id);
  if (!appointment) {
    throw new PaymentLinkNotFoundError();
  }
  if (record.expires_at.getTime() < Date.now() || appointment.status === 'cancelled') {
    throw new PaymentLinkGoneError();
  }
  return appointment;
}

export async function getPublicPaymentView(token: string): Promise<PublicPaymentView> {
  const appointment = await resolveLink(token);
  const [{ amount, currency }, methods, service] = await Promise.all([
    resolveAppointmentAmount(appointment),
    loadAccountPaymentMethods(appointment.account_id),
    findService(appointment.account_id, appointment.service_id),
  ]);

  const payable = !appointment.is_paid && amount > 0;
  return {
    appointment: {
      serviceName: service?.name ?? '',
      scheduledAt: appointment.appointment_at.toISOString(),
      amount,
      currency,
      isPaid: appointment.is_paid,
    },
    canPayOnline: payable && canPayOnline(methods, currency),
    manual: payable
      ? methods.manual
      : { bankTransfer: null, customLink: null, cash: null },
  };
}

export async function createPublicCheckout(token: string): Promise<{ redirectUrl: string }> {
  const appointment = await resolveLink(token);
  if (appointment.is_paid) {
    throw new PaymentLinkGoneError();
  }

  const { amount, currency } = await resolveAppointmentAmount(appointment);
  const methods: AccountPaymentMethods = await loadAccountPaymentMethods(appointment.account_id);
  const provider = methods.onlineProvider;
  if (amount <= 0 || !provider || !canPayOnline(methods, currency)) {
    throw new PaymentUnavailableError();
  }

  const pending = await findPendingOrderForAppointment(appointment.account_id, appointment.id);
  if (pending) {
    const ageMs = Date.now() - pending.created_at.getTime();
    const reusable = pending.provider === provider
      && pending.amount === amount
      && pending.currency === currency
      && pending.redirect_url
      && ageMs < PENDING_ORDER_REUSE_MS;
    if (reusable && pending.redirect_url) {
      return { redirectUrl: pending.redirect_url };
    }
    if (!pending.redirect_url && ageMs < PENDING_ORDER_CREATING_MS) {
      // Another checkout for the same appointment is being created right now.
      throw new PaymentUnavailableError();
    }
    await cancelOrder(pending.id);
  }

  const providerRecord = await findAccountPaymentProvider(appointment.account_id, provider);
  if (!providerRecord) {
    throw new PaymentUnavailableError();
  }

  let order;
  try {
    order = await insertPendingOrder({ accountId: appointment.account_id, appointmentId: appointment.id, provider, amount, currency });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PaymentUnavailableError();
    }
    throw error;
  }

  const service = await findService(appointment.account_id, appointment.service_id);
  try {
    const created = await getPaymentAdapter(provider).createPayment({
      credentials: toProviderCredentials(providerRecord),
      orderId: order.id,
      appointmentId: appointment.id,
      amount,
      currency,
      description: service?.name ?? `Appointment #${appointment.id}`,
      returnUrls: {
        success: `${env.APP_URL.replace(/\/+$/, '')}/pay/${token}?status=success`,
        fail: `${env.APP_URL.replace(/\/+$/, '')}/pay/${token}?status=fail`,
      },
      callbackUrl: provider === 'yookassa' || provider === 'bog'
        ? buildProviderCallbackUrl(provider, appointment.account_id)
        : '',
      idempotencyKey: crypto.randomUUID(),
    });
    await attachProviderOrder(order.id, created.providerOrderId, created.redirectUrl);
    return { redirectUrl: created.redirectUrl };
  } catch (error) {
    await cancelOrder(order.id);
    if (error instanceof InvalidCredentialsError) {
      throw new PaymentUnavailableError();
    }
    throw error;
  }
}
