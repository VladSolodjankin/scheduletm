import { dictionaries, type Locale, type TranslationKey } from './dictionaries';

/** Resolves a translation outside React (block registries, validators); components use `useI18n().t`. */
export function translate(locale: Locale, key: TranslationKey): string {
  const nestedValue = key
    .split('.')
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], dictionaries[locale]);

  return typeof nestedValue === 'string' ? nestedValue : key;
}
