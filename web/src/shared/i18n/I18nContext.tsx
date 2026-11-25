import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  type Locale,
  type TranslationKey
} from './dictionaries';
import { translate } from './translate';

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


export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: TranslationKey) => translate(locale, key)
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Renders its children in a fixed language (a public page speaks its own language, not the visitor's). */
export function LocaleScope({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { setLocale } = useI18n();
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: TranslationKey) => translate(locale, key)
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
