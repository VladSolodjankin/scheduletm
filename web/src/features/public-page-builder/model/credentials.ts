import type { BlockContent } from '../types/publicPage';

export const MAX_CREDENTIALS = 10;
export const MIN_CREDENTIAL_YEAR = 1950;
export const MAX_CREDENTIAL_TITLE_LENGTH = 120;
export const MAX_CREDENTIAL_ORGANIZATION_LENGTH = 120;
export const MAX_CREDENTIAL_ALT_LENGTH = 200;

export type CredentialItem = {
  id: string;
  imageMediaId: string | null;
  alt: string;
  title: string;
  organization: string;
  year: string;
};

const stringOf = (value: unknown): string => (typeof value === 'string' ? value : '');

export function maxCredentialYear(now = new Date()): number {
  return now.getFullYear() + 1;
}

export function isValidCredentialYear(year: string, now = new Date()): boolean {
  if (year === '') {return true;}
  if (!/^\d{4}$/.test(year)) {return false;}
  const value = Number(year);
  return value >= MIN_CREDENTIAL_YEAR && value <= maxCredentialYear(now);
}

export function credentialItems(content: BlockContent): CredentialItem[] {
  if (!Array.isArray(content.items)) {return [];}
  return content.items.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {return [];}
    const item = raw as Record<string, unknown>;
    return [{
      id: stringOf(item.id) || `credential-${index + 1}`,
      imageMediaId: typeof item.imageMediaId === 'string' && item.imageMediaId ? item.imageMediaId : null,
      alt: stringOf(item.alt),
      title: stringOf(item.title),
      organization: stringOf(item.organization),
      year: stringOf(item.year),
    }];
  });
}

export function normalizeCredentialsContent(content: BlockContent): BlockContent {
  return { title: stringOf(content.title), items: credentialItems(content) };
}

export function validateCredentialsContent(content: BlockContent, now = new Date()): string[] {
  const issues: string[] = [];
  if (stringOf(content.title).length > 120) {issues.push('title is too long');}
  if (Array.isArray(content.items) && content.items.length > MAX_CREDENTIALS) {issues.push('items has too many entries');}
  credentialItems(content).forEach((item, index) => {
    const path = `items.${index}`;
    if (!item.title.trim()) {issues.push(`${path}.title is required`);}
    if (item.title.length > MAX_CREDENTIAL_TITLE_LENGTH) {issues.push(`${path}.title is too long`);}
    if (!item.imageMediaId) {issues.push(`${path}.imageMediaId is required`);}
    if (!item.alt.trim()) {issues.push(`${path}.alt is required`);}
    if (item.alt.length > MAX_CREDENTIAL_ALT_LENGTH) {issues.push(`${path}.alt is too long`);}
    if (item.organization.length > MAX_CREDENTIAL_ORGANIZATION_LENGTH) {issues.push(`${path}.organization is too long`);}
    if (!isValidCredentialYear(item.year, now)) {issues.push(`${path}.year is invalid`);}
  });
  return issues;
}
