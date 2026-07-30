export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_PUBLIC_PAGE_SLUGS = new Set([
  'api',
  'appointments',
  'assets',
  'health',
  'login',
  'logout',
  'public-pages',
  'register',
  'settings',
  'specialists',
  'users',
]);

export type SlugValidationCode = 'required' | 'too_short' | 'too_long' | 'invalid_format' | 'reserved';

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function validateSlug(value: string): SlugValidationCode | null {
  const slug = normalizeSlug(value);
  if (!slug) {return 'required';}
  if (slug.length < SLUG_MIN_LENGTH) {return 'too_short';}
  if (slug.length > SLUG_MAX_LENGTH) {return 'too_long';}
  if (!SLUG_PATTERN.test(slug)) {return 'invalid_format';}
  return RESERVED_PUBLIC_PAGE_SLUGS.has(slug) ? 'reserved' : null;
}

export function isValidSlug(value: string): boolean {
  return validateSlug(value) === null;
}
