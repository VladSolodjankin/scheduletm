import type { CtaAction } from '../types/publicPage';

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

type ContactRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ContactRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSafeUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return SAFE_PROTOCOLS.has(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

export function normalizeCtaAction(action: CtaAction): CtaAction | null {
  switch (action.type) {
    case 'url':
    case 'messenger': {
      const url = parseSafeUrl(action.url);
      return url ? { type: action.type, url: url.toString() } : null;
    }
    case 'phone': {
      const phone = normalizePhone(action.phone);
      return /^\+?[1-9]\d{6,14}$/.test(phone) ? { type: 'phone', phone } : null;
    }
    case 'email': {
      const email = action.email.trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { type: 'email', email } : null;
    }
  }
}

export function isSafeCtaAction(action: CtaAction): boolean {
  return normalizeCtaAction(action) !== null;
}

export function isCtaAction(value: unknown): value is CtaAction {
  if (!isRecord(value)) {return false;}
  switch (value.type) {
    case 'url':
    case 'messenger':
      return typeof value.url === 'string';
    case 'phone':
      return typeof value.phone === 'string';
    case 'email':
      return typeof value.email === 'string';
    default:
      return false;
  }
}

export function ctaActionToHref(action: CtaAction): string | null {
  const normalized = normalizeCtaAction(action);
  if (!normalized) {return null;}
  switch (normalized.type) {
    case 'url':
    case 'messenger':
      return normalized.url;
    case 'phone':
      return `tel:${normalized.phone}`;
    case 'email':
      return `mailto:${normalized.email}`;
  }
}

export function contactHref(value: unknown): string | null {
  if (!isRecord(value)) {return null;}
  return isCtaAction(value.action) ? ctaActionToHref(value.action) : null;
}

export function validateContacts(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['contacts is required'];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {return [`contacts.${index} is invalid`];}
    const issues: string[] = [];
    if (typeof item.label !== 'string' || !item.label.trim()) {
      issues.push(`contacts.${index}.label is required`);
    }
    if (!isCtaAction(item.action)) {
      issues.push(`contacts.${index}.action is invalid`);
    }
    return issues;
  });
}
