import type { Request } from 'express';
import { DEFAULT_LOCALE, dictionaries, type Locale, type TranslationKey } from './dictionaries.js';

const supportedLocales = Object.keys(dictionaries) as Locale[];

const normalizeLocale = (value?: string): Locale | null => {
  if (!value) {
    return null;
  }

  const lowered = value.toLowerCase();
  if (lowered.startsWith('ru')) {
    return 'ru';
  }

  if (lowered.startsWith('en')) {
    return 'en';
  }

  return null;
};

export const resolveLocale = (req: Request): Locale => {
  const explicitLocale = typeof req.headers['x-locale'] === 'string'
    ? req.headers['x-locale']
    : undefined;

  const fromExplicit = normalizeLocale(explicitLocale);
  if (fromExplicit) {
    return fromExplicit;
  }

  const acceptLanguage = typeof req.headers['accept-language'] === 'string'
    ? req.headers['accept-language']
    : '';

  const firstLocale = acceptLanguage
    .split(',')
    .map((part) => part.trim())
    .map((part) => part.split(';')[0])
    .find((part) => Boolean(part));

  const fromHeader = normalizeLocale(firstLocale);
  if (fromHeader && supportedLocales.includes(fromHeader)) {
    return fromHeader;
  }

  return DEFAULT_LOCALE;
};

export const t = (req: Request, key: TranslationKey): string => {
  const locale = resolveLocale(req);
  return dictionaries[locale].errors[key];
};
