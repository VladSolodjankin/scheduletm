import type { PublicPageDocument } from '../config/publicPageSchemas.js';

export function publicPageBlocks(document: PublicPageDocument) {
  return [...document.sections.flatMap((section) => section.blocks), ...document.archivedBlocks.map(({ block }) => block)];
}

export function collectPublicPageMediaIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => collectPublicPageMediaIds(item, result));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (/mediaId$/i.test(key) && typeof item === 'string') result.add(item);
      collectPublicPageMediaIds(item, result);
    }
  }
  return result;
}

export function publicSnapshotWithoutArchive(document: PublicPageDocument): PublicPageDocument {
  const archivedIds = collectPublicPageMediaIds(document.archivedBlocks);
  const published = { ...document, archivedBlocks: [] };
  const activeIds = collectPublicPageMediaIds({ ...published, media: [] });
  return { ...published, media: document.media.filter(({ id }) => !archivedIds.has(id) || activeIds.has(id)) };
}
