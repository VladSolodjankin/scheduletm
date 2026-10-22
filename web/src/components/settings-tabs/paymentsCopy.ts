import { dictionaries, type TranslationKey } from '../../shared/i18n/dictionaries';

export type PaymentsCopy = Record<keyof typeof dictionaries.en.payments, string>;

const PAYMENTS_COPY_KEYS = Object.keys(dictionaries.en.payments) as Array<keyof PaymentsCopy>;

/** Resolves every `payments.*` locale key once, so the tab receives plain strings like other settings tabs. */
export function buildPaymentsCopy(t: (key: TranslationKey) => string): PaymentsCopy {
  return Object.fromEntries(
    PAYMENTS_COPY_KEYS.map((key) => [key, t(`payments.${key}`)]),
  ) as PaymentsCopy;
}
