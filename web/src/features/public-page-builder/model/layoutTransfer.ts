import { publicPageDocumentSchema } from '@meetli/shared/public-page';
import { PUBLIC_PAGE_SCHEMA_VERSION, type PublicPageDocument } from '../types/publicPage';
import { createStableId } from '../utils/createStableId';

const LAYOUT_FORMAT = 'meetli-public-page-layout';

export type LayoutImportErrorCode = 'invalid' | 'unsupported';

export class LayoutImportError extends Error {
  constructor(public readonly code: LayoutImportErrorCode) {
    super(code);
  }
}

/** Drops images and linked services: they belong to the source account and cannot be moved as text. */
function stripAccountData(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    if (key === 'serviceIds') {return [];}
    return value
      // Gallery entries are nothing but an image reference.
      .filter((item) => !(typeof item === 'object' && item !== null && typeof (item as { mediaId?: unknown }).mediaId === 'string'))
      .map((item) => stripAccountData(item));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([entryKey, item]) => [
      entryKey,
      /mediaId$/i.test(entryKey) && typeof item === 'string' ? null : stripAccountData(item, entryKey),
    ]));
  }
  return value;
}

function remapIds(document: PublicPageDocument): PublicPageDocument {
  const sectionIds = new Map<string, string>();
  const sectionId = (source: string) => {
    if (!sectionIds.has(source)) {sectionIds.set(source, createStableId());}
    return sectionIds.get(source)!;
  };
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      id: sectionId(section.id),
      blocks: section.blocks.map((block) => ({ ...block, id: createStableId() })),
    })),
    archivedBlocks: document.archivedBlocks.map(({ block, sourceSectionId }) => ({
      block: { ...block, id: createStableId() },
      sourceSectionId: sectionId(sourceSectionId),
    })),
  };
}

/** Serialises the page layout (settings, name and element order) without images, services, address or ids of the source account. */
export function exportPublicPageLayout(document: PublicPageDocument): string {
  const rest: Record<string, unknown> = { ...document };
  for (const key of ['id', 'slug', 'status', 'createdAt', 'updatedAt', 'media']) {
    delete rest[key];
  }
  return JSON.stringify({
    format: LAYOUT_FORMAT,
    schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION,
    page: stripAccountData(rest),
  }, null, 2);
}

/** Builds a new draft document from copied JSON. Throws `LayoutImportError` when the text is not a usable layout. */
export function importPublicPageLayout(text: string): PublicPageDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LayoutImportError('invalid');
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { format?: unknown }).format !== LAYOUT_FORMAT) {
    throw new LayoutImportError('invalid');
  }
  const { schemaVersion, page } = parsed as { schemaVersion?: unknown; page?: unknown };
  if (schemaVersion !== PUBLIC_PAGE_SCHEMA_VERSION) {
    throw new LayoutImportError('unsupported');
  }
  if (typeof page !== 'object' || page === null) {
    throw new LayoutImportError('invalid');
  }

  const id = createStableId();
  const now = new Date().toISOString();
  const candidate = {
    ...(stripAccountData(page) as Record<string, unknown>),
    id,
    // A fresh default address, the same as a page created from a template.
    slug: `page-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 40),
    status: 'draft',
    media: [],
    createdAt: now,
    updatedAt: now,
  };
  const checked = publicPageDocumentSchema.safeParse(candidate);
  if (!checked.success) {
    throw new LayoutImportError('invalid');
  }
  return remapIds(checked.data as PublicPageDocument);
}
