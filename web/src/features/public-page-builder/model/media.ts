import type { MediaReference } from '../types/publicPage';

export const ALLOWED_MEDIA_MIME_TYPES = new Set<MediaReference['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type MediaValidationCode =
  | 'unsupported_type'
  | 'invalid_dimensions'
  | 'https_url_required';

function isAbsoluteHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isPersistableMediaReference(media: MediaReference): boolean {
  return media.width >= 0
    && media.height >= 0
    && ALLOWED_MEDIA_MIME_TYPES.has(media.mimeType)
    && isAbsoluteHttpsUrl(media.url);
}

export function validateMediaReference(media: MediaReference): MediaValidationCode | null {
  if (!ALLOWED_MEDIA_MIME_TYPES.has(media.mimeType)) {return 'unsupported_type';}
  if (media.width < 0 || media.height < 0) {return 'invalid_dimensions';}
  return isAbsoluteHttpsUrl(media.url) ? null : 'https_url_required';
}
