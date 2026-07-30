import type { CtaAction } from '../types/publicPage';

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

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
