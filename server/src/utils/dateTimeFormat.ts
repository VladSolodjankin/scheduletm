export function formatAppointmentDateTime(date: Date, timezone: string, locale: 'ru' | 'en' = 'ru'): string {
  const resolvedLocale = locale === 'ru' ? 'ru-RU' : 'en-US';

  try {
    return new Intl.DateTimeFormat(resolvedLocale, {
      timeZone: timezone || 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(resolvedLocale, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
