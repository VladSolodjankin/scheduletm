import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type BlockContent,
  type BlockDesign,
  type MediaReference,
  type PageBlock,
  type PageProfile,
  type PageSection,
  type PageSeo,
  type PageTheme,
  type PublicPageDocument,
  type PublicPageStatus,
  type SectionLayout,
} from '../types/publicPage';
import { createStableId } from '../utils/createStableId';

const statuses = new Set<PublicPageStatus>(['draft', 'published', 'archived']);
const layouts = new Set<SectionLayout>([
  'single',
  'two-equal',
  'one-third-two-thirds',
  'two-thirds-one-third',
  'three-equal',
  'stack',
  'hero-overlay',
]);
const imageMimeTypes = new Set<MediaReference['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stableId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : createStableId();
}

function normalizeProfile(value: unknown): PageProfile {
  const profile = isRecord(value) ? value : {};

  return {
    displayName: stringValue(profile.displayName),
    description: stringValue(profile.description),
    logoMediaId: nullableString(profile.logoMediaId),
    avatarMediaId: nullableString(profile.avatarMediaId),
  };
}

function normalizeTheme(value: unknown): PageTheme {
  const theme = isRecord(value) ? value : {};
  const colors = isRecord(theme.colors) ? theme.colors : {};

  return {
    id: stringValue(theme.id, 'minimal-light'),
    name: stringValue(theme.name, 'Minimal Light'),
    colors: {
      background: stringValue(colors.background, '#ffffff'),
      surface: stringValue(colors.surface, '#ffffff'),
      text: stringValue(colors.text, '#111827'),
      primary: stringValue(colors.primary, '#2563eb'),
    },
  };
}

function normalizeSeo(value: unknown): PageSeo {
  const seo = isRecord(value) ? value : {};

  return {
    title: stringValue(seo.title),
    description: stringValue(seo.description),
    imageMediaId: nullableString(seo.imageMediaId),
  };
}

function normalizeDesign(value: unknown): BlockDesign {
  const design = isRecord(value) ? value : {};

  return {
    backgroundColor: nullableString(design.backgroundColor),
    textColor: nullableString(design.textColor),
  };
}

function normalizeBlock(value: unknown): PageBlock | null {
  if (!isRecord(value) || typeof value.type !== 'string' || value.type.length === 0) {
    return null;
  }

  return {
    id: stableId(value.id),
    type: value.type,
    name: stringValue(value.name),
    visible: typeof value.visible === 'boolean' ? value.visible : true,
    content: isRecord(value.content) ? value.content as BlockContent : {},
    design: normalizeDesign(value.design),
  };
}

function normalizeSection(value: unknown): PageSection | null {
  if (!isRecord(value)) {
    return null;
  }

  const layout = layouts.has(value.layout as SectionLayout)
    ? value.layout as SectionLayout
    : 'single';
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(normalizeBlock).filter((block): block is PageBlock => block !== null)
    : [];

  return {
    id: stableId(value.id),
    name: stringValue(value.name),
    visible: typeof value.visible === 'boolean' ? value.visible : true,
    layout,
    blocks,
  };
}

function normalizeMedia(value: unknown): MediaReference | null {
  if (!isRecord(value) || typeof value.url !== 'string') {
    return null;
  }

  const mimeType = imageMimeTypes.has(value.mimeType as MediaReference['mimeType'])
    ? value.mimeType as MediaReference['mimeType']
    : 'image/jpeg';

  return {
    id: stableId(value.id),
    url: value.url,
    mimeType,
    alt: stringValue(value.alt),
    width: typeof value.width === 'number' && value.width >= 0 ? value.width : 0,
    height: typeof value.height === 'number' && value.height >= 0 ? value.height : 0,
  };
}

export function normalizeDocument(input: unknown): PublicPageDocument {
  const document = isRecord(input) ? input : {};
  const now = new Date().toISOString();
  const status = statuses.has(document.status as PublicPageStatus)
    ? document.status as PublicPageStatus
    : 'draft';
  const sections = Array.isArray(document.sections)
    ? document.sections.map(normalizeSection).filter((section): section is PageSection => section !== null)
    : [];
  const media = Array.isArray(document.media)
    ? document.media.map(normalizeMedia).filter((item): item is MediaReference => item !== null)
    : [];

  return {
    schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION,
    id: stableId(document.id),
    slug: stringValue(document.slug).trim().toLowerCase(),
    status,
    profile: normalizeProfile(document.profile),
    theme: normalizeTheme(document.theme),
    sections,
    seo: normalizeSeo(document.seo),
    media,
    createdAt: stringValue(document.createdAt, now),
    updatedAt: stringValue(document.updatedAt, now),
  };
}
