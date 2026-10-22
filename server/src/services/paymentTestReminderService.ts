import { env } from '../config/env.js';
import { paymentCopy } from '../i18n/paymentCopy.js';
import { findAccountSettingsByAccountId } from '../repositories/accountSettingsRepository.js';
import { formatAppointmentDateTime } from '../utils/dateTimeFormat.js';
import { sendAppointmentNotificationEmail } from './emailDeliveryService.js';
import { buildPaymentReminderContent, resolveAccountNotificationLocale } from './paymentReminderService.js';
import { hasAnyManualMethod, loadAccountPaymentMethods } from './paymentSettingsService.js';

export class NoPaymentMethodError extends Error {
  constructor() {
    super('NO_PAYMENT_METHOD');
  }
}

export class TestReminderDeliveryError extends Error {
  constructor() {
    super('TEST_REMINDER_DELIVERY_FAILED');
  }
}

const SAMPLE_AMOUNT = 1000;
const SAMPLE_CURRENCY_BY_PROVIDER = { yookassa: 'RUB', bog: 'GEL', stripe: 'USD' } as const;

/**
 * Sends the real payment-reminder email (same template and copy) with a sample amount to the requesting user only.
 * Does not touch the notifications table.
 */
export async function sendTestPaymentReminder(user: { accountId: number; email: string }): Promise<{ sentTo: string }> {
  const methods = await loadAccountPaymentMethods(user.accountId);
  if (!methods.onlineProvider && !hasAnyManualMethod(methods.manual)) {
    throw new NoPaymentMethodError();
  }

  const [locale, accountSettings] = await Promise.all([
    resolveAccountNotificationLocale(user.accountId),
    findAccountSettingsByAccountId(user.accountId),
  ]);
  const currency = methods.onlineProvider
    ? SAMPLE_CURRENCY_BY_PROVIDER[methods.onlineProvider]
    : (locale === 'ru' ? 'RUB' : 'USD');
  const content = buildPaymentReminderContent({
    locale,
    amount: SAMPLE_AMOUNT,
    currency,
    methods,
    payUrl: methods.onlineProvider ? `${env.APP_URL.replace(/\/+$/, '')}/pay/test-preview` : null,
  });

  const sample = paymentCopy[locale].sample;
  const delivered = await sendAppointmentNotificationEmail({
    to: user.email,
    clientName: sample.client,
    specialistName: sample.specialist,
    scheduledAt: formatAppointmentDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000), accountSettings?.timezone || 'UTC', locale),
    notificationType: 'payment_reminder',
    locale,
    serviceName: sample.service,
    payment: {
      amountText: content.amountText,
      payUrl: content.payUrl,
      bankTransferText: content.bankTransferText,
      customLink: content.customLink,
      cashComment: content.cashComment,
      isTest: true,
    },
  });
  if (!delivered) {
    throw new TestReminderDeliveryError();
  }

  return { sentTo: user.email };
}
