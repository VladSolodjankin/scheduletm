import { dictionaries, SupportedLanguage } from './dictionaries';

export function normalizeLanguageCode(input?: string | null): SupportedLanguage {
  if (!input) return 'ru';

  const code = input.toLowerCase();

  if (code.startsWith('ru')) return 'ru';
  if (code.startsWith('en')) return 'en';

  return 'ru';
}

export function t(
  lang: SupportedLanguage,
  key: string,
  params?: Record<string, string | number>,
): string {
  const value =
    dictionaries[lang]?.[key] ??
    dictionaries.ru[key] ??
    key;

  if (!params) return value;

  return Object.entries(params).reduce((acc, [k, v]) => {
    return acc.replaceAll(`{{${k}}}`, String(v));
  }, value);
}
