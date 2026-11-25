import type { TranslationKey } from '../../shared/i18n/dictionaries';

export function formatServiceDuration(value: number, t: (key: TranslationKey) => string) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) {
    return `${minutes} ${t('services.minutes')}`;
  }
  return minutes
    ? `${hours} ${t('services.hoursShort')} ${minutes} ${t('services.minutes')}`
    : `${hours} ${t('services.hoursShort')}`;
}
