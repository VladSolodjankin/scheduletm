import { env } from '../config/env.js';
import { findAccountSettingsByAccountId } from '../repositories/accountSettingsRepository.js';
import { findResolvedServicePrice } from '../repositories/accountPaymentRepository.js';
import type { AppointmentRecord } from '../repositories/appointmentRepository.js';
import { createAppointmentPaymentToken } from '../repositories/paymentTokenRepository.js';
import {
  formatMoney,
  normalizeNotificationLocale,
  paymentCopy,
  type NotificationLocale,
} from '../i18n/paymentCopy.js';
import {
  hasAnyManualMethod,
  loadAccountPaymentMethods,
  type AccountPaymentMethods,
} from './paymentSettingsService.js';
import { getPaymentAdapter } from './payments/registry.js';
import { isStripeConfigured } from './payments/stripeAdapter.js';

const PAY_LINK_MIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAY_LINK_TTL_AFTER_APPOINTMENT_MS = 30 * 24 * 60 * 60 * 1000;

export type ResolvedAmount = { amount: number; currency: string };

/** Snapshot price if positive, else the current service price (specialist override wins), else 0 (= no payment). */
export async function resolveAppointmentAmount(
  appointment: Pick<AppointmentRecord, 'account_id' | 'service_id' | 'specialist_id' | 'price' | 'currency'>,
  findPrice: typeof findResolvedServicePrice = findResolvedServicePrice,
): Promise<ResolvedAmount> {
  if (appointment.price > 0) {
    return { amount: appointment.price, currency: appointment.currency || 'RUB' };
  }
  const servicePrice = await findPrice(appointment.account_id, appointment.service_id, appointment.specialist_id);
  if (servicePrice && servicePrice.price > 0) {
    return { amount: servicePrice.price, currency: servicePrice.currency || 'RUB' };
  }
  return { amount: 0, currency: appointment.currency || 'RUB' };
}

export function canPayOnline(methods: AccountPaymentMethods, currency: string): boolean {
  if (!methods.onlineProvider) {
    return false;
  }
  // Stripe needs the whole platform config (incl. the webhook secret) or a charge could never be marked paid.
  if (methods.onlineProvider === 'stripe' && !isStripeConfigured()) {
    return false;
  }
  return getPaymentAdapter(methods.onlineProvider).supportsCurrency(currency);
}

export type PaymentReminderEligibility =
  | { eligible: false; reason: 'paid' | 'cancelled' | 'no_amount' | 'no_method' }
  | { eligible: true; amount: number; currency: string; methods: AccountPaymentMethods; payOnline: boolean };

/**
 * Gate for payment_reminder. Must run BEFORE the notifications row is created (that row is unique per
 * appointment+type, so a reminder swallowed here would otherwise be lost forever).
 * `getMethods` / `getAmount` are injectable so the job can cache lookups per run.
 */
export async function evaluatePaymentReminderEligibility(
  appointment: AppointmentRecord,
  deps: {
    getMethods?: (accountId: number) => Promise<AccountPaymentMethods>;
    getAmount?: (appointment: AppointmentRecord) => Promise<ResolvedAmount>;
  } = {},
): Promise<PaymentReminderEligibility> {
  if (appointment.is_paid) {
    return { eligible: false, reason: 'paid' };
  }
  if (appointment.status === 'cancelled') {
    return { eligible: false, reason: 'cancelled' };
  }

  const { amount, currency } = await (deps.getAmount ?? resolveAppointmentAmount)(appointment);
  if (amount <= 0) {
    return { eligible: false, reason: 'no_amount' };
  }

  const methods = await (deps.getMethods ?? loadAccountPaymentMethods)(appointment.account_id);
  const payOnline = canPayOnline(methods, currency);
  if (!payOnline && !hasAnyManualMethod(methods.manual)) {
    return { eligible: false, reason: 'no_method' };
  }

  return { eligible: true, amount, currency, methods, payOnline };
}

/** Run-scoped cached gate used by the notifications job (one lookup per account / service per run). */
export function createCachedPaymentReminderGate() {
  const methodsCache = new Map<number, Promise<AccountPaymentMethods>>();
  const amountCache = new Map<string, Promise<ResolvedAmount>>();

  return (appointment: AppointmentRecord) => evaluatePaymentReminderEligibility(appointment, {
    getMethods: (accountId) => {
      if (!methodsCache.has(accountId)) {
        methodsCache.set(accountId, loadAccountPaymentMethods(accountId));
      }
      return methodsCache.get(accountId)!;
    },
    getAmount: (item) => {
      if (item.price > 0) {
        return resolveAppointmentAmount(item);
      }
      const key = `${item.account_id}:${item.service_id}:${item.specialist_id}`;
      if (!amountCache.has(key)) {
        amountCache.set(key, resolveAppointmentAmount(item));
      }
      return amountCache.get(key)!;
    },
  });
}

export async function resolveAccountNotificationLocale(accountId: number): Promise<NotificationLocale> {
  const settings = await findAccountSettingsByAccountId(accountId);
  return normalizeNotificationLocale(settings?.locale);
}

export type PaymentReminderContent = {
  locale: NotificationLocale;
  amountText: string;
  payUrl: string | null;
  bankTransferText: string | null;
  customLink: { title: string; url: string } | null;
  cashComment: string | null;
  hasManual: boolean;
};

export function buildPaymentReminderContent(input: {
  locale: NotificationLocale;
  amount: number;
  currency: string;
  methods: AccountPaymentMethods;
  payUrl: string | null;
}): PaymentReminderContent {
  const { manual } = input.methods;
  return {
    locale: input.locale,
    amountText: formatMoney(input.amount, input.currency, input.locale),
    payUrl: input.payUrl,
    bankTransferText: manual.bankTransfer?.text ?? null,
    customLink: manual.customLink,
    cashComment: manual.cash ? manual.cash.comment : null,
    hasManual: hasAnyManualMethod(manual),
  };
}

export async function createPayUrl(appointment: Pick<AppointmentRecord, 'id' | 'appointment_at'>): Promise<string> {
  const expiresAt = new Date(Math.max(
    appointment.appointment_at.getTime() + PAY_LINK_TTL_AFTER_APPOINTMENT_MS,
    Date.now() + PAY_LINK_MIN_TTL_MS,
  ));
  const token = await createAppointmentPaymentToken(appointment.id, expiresAt);
  return `${env.APP_URL.replace(/\/+$/, '')}/pay/${token}`;
}

/** Plain-text lines of the payment info (Telegram body and the text part of email). */
export function buildTelegramPaymentText(
  content: PaymentReminderContent,
  specialistName: string,
  scheduledAt: string,
): string {
  const copy = paymentCopy[content.locale];
  const lines = [copy.telegramIntro(specialistName, scheduledAt), copy.telegramAmount(content.amountText)];
  if (content.payUrl) {
    lines.push('', copy.telegramPay(content.payUrl));
  }
  if (content.hasManual) {
    lines.push('', copy.telegramTransferTitle);
    if (content.bankTransferText) {
      lines.push(`${copy.bankTransferLabel}: ${content.bankTransferText}`);
    }
    if (content.customLink) {
      lines.push(`${content.customLink.title}: ${content.customLink.url}`);
    }
    if (content.cashComment !== null) {
      lines.push(content.cashComment ? `${copy.cashLabel}: ${content.cashComment}` : copy.cashLabel);
    }
  }
  return lines.join('\n');
}
