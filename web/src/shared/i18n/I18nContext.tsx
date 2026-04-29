import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  dictionaries,
  type Locale,
  type TranslationKey
} from './dictionaries';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = 'ui-locale';

function getInitialLocale(): Locale {
  const persisted = localStorage.getItem(STORAGE_KEY);
  if (persisted === 'en' || persisted === 'ru') {
    return persisted;
  }

  const systemLocales = navigator.languages?.length ? navigator.languages : [navigator.language];
  const matched = systemLocales
    .map((locale) => locale.toLowerCase())
    .find((locale) => locale.startsWith('ru') || locale.startsWith('en'));

  if (!matched) {
    return DEFAULT_LOCALE;
  }

  return matched.startsWith('ru') ? 'ru' : 'en';
}

function getTranslation(locale: Locale, key: TranslationKey): string {
  const nestedValue = key
    .split('.')
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], dictionaries[locale]);

  if (typeof nestedValue === 'string') {
    return nestedValue;
  }

  return key;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: TranslationKey) => getTranslation(locale, key)
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
