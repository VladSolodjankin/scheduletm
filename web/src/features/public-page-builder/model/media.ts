import type { MediaReference, PublicPageDocument } from '../types/publicPage';

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

function containsMediaId(value: unknown, mediaId: string): boolean {
  if (Array.isArray(value)) {return value.some((item) => containsMediaId(item, mediaId));}
  if (!value || typeof value !== 'object') {return false;}
  return Object.entries(value).some(([key, item]) =>
    (/mediaId$/i.test(key) && item === mediaId) || containsMediaId(item, mediaId));
}

export function documentReferencesMedia(document: PublicPageDocument, mediaId: string): boolean {
  return containsMediaId(document.profile, mediaId)
    || containsMediaId(document.theme, mediaId)
    || containsMediaId(document.seo, mediaId)
    || containsMediaId(document.sections, mediaId);
}

export function canDeleteMediaFromDocuments(documents: readonly PublicPageDocument[], mediaId: string): boolean {
  return documents.every((document) => !documentReferencesMedia(document, mediaId));
}

export function reconcilePendingMediaCleanup<T extends { media: { id: string } }>(
  pending: readonly T[],
  failedBefore: ReadonlySet<string>,
  attemptedIds: ReadonlySet<string>,
  failedAttemptIds: ReadonlySet<string>,
): { pending: T[]; failedIds: Set<string> } {
  const failedIds = new Set([...failedBefore].filter((id) => !attemptedIds.has(id)));
  failedAttemptIds.forEach((id) => failedIds.add(id));
  return {
    pending: pending.filter((item) => !attemptedIds.has(item.media.id) || failedAttemptIds.has(item.media.id)),
    failedIds,
  };
}
