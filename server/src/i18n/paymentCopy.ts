export type NotificationLocale = 'ru' | 'en';

/** User-visible copy of payment reminders (email + Telegram). Server error messages live in dictionaries.ts. */
export const paymentCopy = {
  en: {
    subject: 'Meetli - payment reminder',
    title: 'Payment reminder',
    body: (clientName: string, specialistName: string) =>
      `${clientName}, a friendly reminder to pay for your appointment with ${specialistName}.`,
    amountLabel: 'Amount',
    payButton: 'Pay online',
    transferTitle: 'Or pay another way',
    bankTransferLabel: 'Bank transfer',
    cashLabel: 'Cash',
    testBanner: 'This is a test reminder - no real appointment is attached.',
    telegramIntro: (specialistName: string, scheduledAt: string) =>
      `Payment reminder for your appointment with ${specialistName} on ${scheduledAt}.`,
    telegramAmount: (amount: string) => `Amount: ${amount}`,
    telegramPay: (url: string) => `Pay online: ${url}`,
    telegramTransferTitle: 'Or pay another way:',
    sample: { client: 'Anna', specialist: 'Your specialist', service: 'Consultation' },
  },
  ru: {
    subject: 'Meetli - напоминание об оплате',
    title: 'Напоминание об оплате',
    body: (clientName: string, specialistName: string) =>
      `${clientName}, напоминаем об оплате записи к специалисту ${specialistName}.`,
    amountLabel: 'Сумма',
    payButton: 'Оплатить онлайн',
    transferTitle: 'Или оплатите другим способом',
    bankTransferLabel: 'Банковский перевод',
    cashLabel: 'Наличными',
    testBanner: 'Это тестовое напоминание - реальной записи нет.',
    telegramIntro: (specialistName: string, scheduledAt: string) =>
      `Напоминание об оплате записи к ${specialistName} на ${scheduledAt}.`,
    telegramAmount: (amount: string) => `Сумма: ${amount}`,
    telegramPay: (url: string) => `Оплатить онлайн: ${url}`,
    telegramTransferTitle: 'Или оплатите другим способом:',
    sample: { client: 'Анна', specialist: 'Ваш специалист', service: 'Консультация' },
  },
} as const;

export function normalizeNotificationLocale(value: string | null | undefined): NotificationLocale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function formatMoney(amount: number, currency: string, locale: NotificationLocale): string {
  try {
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
