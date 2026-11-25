type DateInput = Date | string | number;

function toDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value);
}

/** Date and time in the interface language, e.g. "25 нояб. 2026 г., 14:30". */
export function formatDateTime(
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(toDate(value));
}

/** Date only in the interface language; pass options for weekday/month variants. */
export function formatDate(value: DateInput, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(locale, options).format(toDate(value));
}

/** Hours and minutes in the interface language. */
export function formatTime(value: DateInput, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(toDate(value));
}
