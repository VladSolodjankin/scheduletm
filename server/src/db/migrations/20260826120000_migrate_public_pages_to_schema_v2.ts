import type { Knex } from 'knex';
import { z } from 'zod';

type SnapshotName = 'draft_document' | 'published_document';
type JsonRecord = Record<string, unknown>;

// Historical migrations must remain deterministic when the runtime schema evolves.
const MIGRATION_PUBLIC_PAGE_SCHEMA_VERSION = 2 as const;
const nullableStringSchema = z.string().nullable();
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url'), url: z.string() }).strict(),
  z.object({ type: z.literal('phone'), phone: z.string() }).strict(),
  z.object({ type: z.literal('email'), email: z.string() }).strict(),
  z.object({ type: z.literal('messenger'), url: z.string() }).strict(),
]);
const typographySchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.number().min(8).max(96),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(['normal', 'italic']),
  color: z.string().min(1),
}).strict();
const typographyOverrideSchema = z.object({
  fontFamily: nullableStringSchema,
  fontSize: z.number().min(8).max(96).nullable(),
  fontWeight: z.number().int().min(100).max(900).nullable(),
  fontStyle: z.enum(['normal', 'italic']).nullable(),
  color: nullableStringSchema,
}).strict();
const linkStyleSchema = z.object({
  titleStyle: typographySchema,
  subtitleStyle: typographySchema,
  backgroundColor: z.string().min(1),
  backgroundOpacity: z.number().min(0).max(1),
  borderWidth: z.number().min(0).max(16),
  borderColor: z.string().min(1),
  shadow: z.boolean(),
}).strict();
const linkStyleOverrideSchema = z.object({
  titleStyle: typographyOverrideSchema,
  subtitleStyle: typographyOverrideSchema,
  backgroundColor: nullableStringSchema,
  backgroundOpacity: z.number().min(0).max(1).nullable(),
  borderWidth: z.number().min(0).max(16).nullable(),
  borderColor: nullableStringSchema,
  shadow: z.boolean().nullable(),
}).strict();
const blockDesignSchema = z.object({
  backgroundColor: nullableStringSchema,
  textColor: nullableStringSchema,
  backgroundMediaId: nullableStringSchema,
  backgroundOverlay: z.number().min(0).max(1),
  backgroundFit: z.enum(['cover', 'contain']),
  backgroundPosition: z.string().min(1),
  paddingTop: z.number().min(0).max(160),
  paddingBottom: z.number().min(0).max(160),
  borderRadius: z.number().min(0).max(100).nullable(),
}).strict();
const blockFields = {
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  design: blockDesignSchema,
};
const richTextDocumentSchema = z.object({
  type: z.literal('rich-text-v1'),
  paragraphs: z.array(z.object({
    size: z.enum(['small', 'medium', 'large', 'h1', 'h2', 'h3']),
    fontFamily: z.string().min(1).nullable(),
    alignment: z.enum(['left', 'center', 'right', 'justify']),
    runs: z.array(z.object({
      text: z.string(),
      marks: z.object({
        bold: z.literal(true).optional(),
        italic: z.literal(true).optional(),
        underline: z.literal(true).optional(),
        strike: z.literal(true).optional(),
        color: z.string().min(1).optional(),
      }).strict().optional(),
    }).strict()).min(1),
  }).strict()).min(1),
}).strict();
const blockSchema = z.discriminatedUnion('type', [
  z.object({ ...blockFields, type: z.literal('avatar'), content: z.object({
    heading: z.string(), subtitle: z.string(), imageMediaId: nullableStringSchema,
    imageAlt: z.string(), layout: z.enum(['centered', 'cover-centered', 'cover-left', 'image-cover']),
    avatarSize: z.union([z.literal(65), z.literal(95), z.literal(125), z.literal(150)]),
    coverColor: nullableStringSchema, coverMediaId: nullableStringSchema,
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('button'), content: z.object({
    label: z.string(), icon: z.enum(['link', 'phone', 'email', 'message']),
    color: z.string(), textColor: z.string(), radius: z.number().min(0).max(100), action: actionSchema,
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('links'), content: z.object({
    links: z.array(z.object({ id: z.string().min(1), label: z.string(), action: actionSchema }).strict()),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('text'), content: z.object({ document: richTextDocumentSchema }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('image'), content: z.object({
    imageMediaId: nullableStringSchema, alt: z.string(),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('gallery'), content: z.object({
    images: z.array(z.object({ mediaId: z.string().min(1), alt: z.string() }).strict()),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('services'), content: z.object({
    title: z.string(),
    serviceIds: z.array(z.number().int().positive()).max(12).refine(
      (ids) => new Set(ids).size === ids.length,
      { message: 'duplicate_service_id' },
    ),
    autoplayIntervalSeconds: z.number().int().min(3).max(30).nullable(),
    showBookingButton: z.boolean(),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('contacts'), content: z.object({
    title: z.string(),
    contacts: z.array(z.object({ id: z.string().min(1), label: z.string(), action: actionSchema }).strict()),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('social-button'), content: z.object({
    platform: z.enum([
      'facebook-messenger', 'vk', 'whatsapp', 'viber', 'telegram',
      'facebook', 'threads', 'instagram', 'tiktok',
    ]),
    label: z.string().trim().min(1),
    url: z.url().refine((url) => ['http:', 'https:'].includes(new URL(url).protocol)),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('map'), content: z.object({
    title: z.string(), address: z.string(), label: z.string(), url: z.string(),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('divider'), content: z.object({}).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('faq'), content: z.object({
    title: z.string(),
    items: z.array(z.object({
      id: z.string().min(1), title: z.string(), description: z.string(),
    }).strict()),
  }).strict() }).strict(),
]);
const sectionSchema = z.object({
  id: z.string().min(1), name: z.string(), visible: z.boolean(),
  layout: z.enum([
    'single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third',
    'three-equal', 'stack', 'hero-overlay',
  ]),
  blocks: z.array(blockSchema),
  design: z.object({
    backgroundColor: nullableStringSchema, textColor: nullableStringSchema,
    backgroundMediaId: nullableStringSchema, backgroundOverlay: z.number().min(0).max(1),
    backgroundFit: z.enum(['cover', 'contain']), backgroundPosition: z.string().min(1),
    variant: z.enum(['off', 'custom', 'primary', 'secondary']),
    paddingTop: z.number().min(0).max(160), paddingBottom: z.number().min(0).max(160),
    horizontalMargin: z.boolean(), borderRadius: z.number().min(0).max(100).nullable(),
    borderWidth: z.number().min(0).max(16), borderColor: nullableStringSchema,
    shadow: z.boolean(), width: z.enum(['full', 'contained']), mobileVisible: z.boolean(),
    headingStyle: typographyOverrideSchema, textStyle: typographyOverrideSchema,
    linkStyle: linkStyleOverrideSchema,
  }).strict(),
}).strict();
const themeTypographyTokenSchema = z.object({
  fontFamily: z.string().min(1), fontSize: z.number().min(8).max(96),
  fontWeight: z.number().int().min(100).max(900), lineHeight: z.number().min(0.5).max(3),
  letterSpacing: z.number().min(-10).max(20),
}).strict();
const mediaItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  alt: z.string(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
}).strict();
const frozenPublicPageDocumentV2Schema = z.object({
  schemaVersion: z.literal(MIGRATION_PUBLIC_PAGE_SCHEMA_VERSION),
  id: z.string().min(1).max(128), slug: z.string(), status: z.enum(['draft', 'published', 'archived']),
  profile: z.object({
    displayName: z.string(), description: z.string(),
    logoMediaId: nullableStringSchema, avatarMediaId: nullableStringSchema,
  }).strict(),
  theme: z.object({
    id: z.string().min(1), name: z.string().min(1),
    swatches: z.tuple([
      z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1),
    ]),
    colors: z.object({
      background: z.string().min(1), surface: z.string().min(1),
      text: z.string().min(1), primary: z.string().min(1),
    }).strict(),
    tokens: z.object({
      colors: z.object({
        contrast: z.string().min(1), linkTitle: z.string().min(1),
        linkSubtitle: z.string().min(1), linkShadow: z.string().min(1),
        linkBorder: z.string().min(1), focus: z.string().min(1),
        checkboxBackground: z.string().min(1),
      }).strict(),
      typography: z.object({
        fontFamily: z.string().min(1), fontWeight: z.number().int().min(100).max(900),
        boldFontWeight: z.number().int().min(100).max(900), headingColor: z.string().min(1),
        avatarTitle: themeTypographyTokenSchema, avatarBio: themeTypographyTokenSchema,
        linkTitle: themeTypographyTokenSchema, linkSubtitle: themeTypographyTokenSchema,
        h1: themeTypographyTokenSchema, h2: themeTypographyTokenSchema, h3: themeTypographyTokenSchema,
        textLarge: themeTypographyTokenSchema, textMedium: themeTypographyTokenSchema,
        textSmall: themeTypographyTokenSchema,
      }).strict(),
      layout: z.object({
        blockRadius: z.number().min(0).max(100), linkRadius: z.number().min(0).max(100),
        linkGap: z.number().min(0).max(100),
      }).strict(),
    }).strict(),
    fontFamily: z.string().min(1), roundingStyle: z.enum(['rounded', 'pill', 'leaf', 'square']),
    backgroundMediaId: nullableStringSchema, backgroundPreset: nullableStringSchema,
    backgroundFit: z.enum(['cover', 'contain']), backgroundPosition: z.string().min(1),
    linkStylePreset: z.enum([
      'primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline',
      'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong',
    ]),
    styleDefaults: z.object({
      sectionBorderRadius: z.number().min(0).max(100), blockBorderRadius: z.number().min(0).max(100),
      headingStyle: typographySchema, textStyle: typographySchema, linkStyle: linkStyleSchema,
    }).strict(),
  }).strict(),
  sections: z.array(sectionSchema),
  seo: z.object({ title: z.string(), description: z.string(), imageMediaId: nullableStringSchema }).strict(),
  media: z.array(mediaItemSchema),
  createdAt: z.string().min(1), updatedAt: z.string().min(1),
}).strict().superRefine((document, ctx) => {
  const ids = [document.id, ...document.sections.flatMap((section) => [
    section.id, ...section.blocks.map((block) => block.id),
  ]), ...document.media.map((media) => media.id)];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'duplicate_id' });
  const socialPlatforms = new Set<string>();
  document.sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      if (block.type !== 'social-button') return;
      if (socialPlatforms.has(block.content.platform)) {
        ctx.addIssue({
          code: 'custom', path: ['sections', sectionIndex, 'blocks', blockIndex, 'content', 'platform'],
          message: 'duplicate_social_platform',
        });
      }
      socialPlatforms.add(block.content.platform);
    });
  });
});
type FrozenPublicPageDocumentV2 = z.infer<typeof frozenPublicPageDocumentV2Schema>;

export type PublicPageV2ConversionContext = {
  pageId: string;
  accountId: number;
  snapshot: SnapshotName;
  ownedServiceIds: ReadonlySet<number>;
};

export type PublicPageV2ConversionResult = {
  document: FrozenPublicPageDocumentV2;
  wasAlreadyV2: boolean;
};

export class PublicPageSchemaV2MigrationError extends Error {
  constructor(
    public readonly pageId: string,
    public readonly snapshot: SnapshotName,
    public readonly path: string,
    detail: string,
  ) {
    super(`Public Page ${pageId} ${snapshot} ${path}: ${detail}`);
  }
}

const record = (value: unknown): JsonRecord | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
);
const string = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const nonEmptyString = (value: unknown, fallback: string): string => (
  typeof value === 'string' && value.length > 0 ? value : fallback
);
const nullableString = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
const boolean = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const finiteNumber = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

function fail(context: PublicPageV2ConversionContext, path: string, detail: string): never {
  throw new PublicPageSchemaV2MigrationError(context.pageId, context.snapshot, path, detail);
}

function assertKeys(
  value: JsonRecord,
  allowed: readonly string[],
  context: PublicPageV2ConversionContext,
  path: string,
): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) fail(context, `${path}.${unexpected}`, 'ambiguous legacy field');
}

function safeWebUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

function canonicalAction(value: unknown): JsonRecord | null {
  const action = record(value);
  if (!action || typeof action.type !== 'string') return null;
  if ((action.type === 'url' || action.type === 'messenger') && safeWebUrl(action.url)) {
    return { type: action.type, url: string(action.url).trim() };
  }
  if (action.type === 'phone' && typeof action.phone === 'string') {
    const phone = action.phone.trim().replace(/[^+\d]/g, '');
    if (/^\+?[1-9]\d{6,14}$/.test(phone)) return { type: 'phone', phone };
  }
  if (action.type === 'email' && typeof action.email === 'string') {
    const email = action.email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { type: 'email', email };
  }
  return null;
}

function contactUrlAction(value: unknown): JsonRecord | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (/^mailto:/i.test(url)) {
    const email = url.slice(7).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { type: 'email', email } : null;
  }
  if (/^tel:/i.test(url)) {
    const phone = url.slice(4).trim().replace(/[^+\d]/g, '');
    return /^\+?[1-9]\d{6,14}$/.test(phone) ? { type: 'phone', phone } : null;
  }
  return safeWebUrl(url) ? { type: 'url', url } : null;
}

function canonicalBlockDesign(value: unknown): JsonRecord {
  const design = record(value) ?? {};
  return {
    backgroundColor: nullableString(design.backgroundColor),
    textColor: nullableString(design.textColor),
    backgroundMediaId: nullableString(design.backgroundMediaId),
    backgroundOverlay: finiteNumber(design.backgroundOverlay, 0),
    backgroundFit: design.backgroundFit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: nonEmptyString(design.backgroundPosition, '50% 50%'),
    paddingTop: finiteNumber(design.paddingTop, 0),
    paddingBottom: finiteNumber(design.paddingBottom, 0),
    borderRadius: typeof design.borderRadius === 'number' ? design.borderRadius : null,
  };
}

function typographyOverride(value: unknown): JsonRecord {
  const style = record(value) ?? {};
  return {
    fontFamily: nullableString(style.fontFamily),
    fontSize: typeof style.fontSize === 'number' ? style.fontSize : null,
    fontWeight: typeof style.fontWeight === 'number' ? style.fontWeight : null,
    fontStyle: style.fontStyle === 'normal' || style.fontStyle === 'italic' ? style.fontStyle : null,
    color: nullableString(style.color),
  };
}

function linkStyleOverride(value: unknown): JsonRecord {
  const style = record(value) ?? {};
  return {
    titleStyle: typographyOverride(style.titleStyle),
    subtitleStyle: typographyOverride(style.subtitleStyle),
    backgroundColor: nullableString(style.backgroundColor),
    backgroundOpacity: typeof style.backgroundOpacity === 'number' ? style.backgroundOpacity : null,
    borderWidth: typeof style.borderWidth === 'number' ? style.borderWidth : null,
    borderColor: nullableString(style.borderColor),
    shadow: typeof style.shadow === 'boolean' ? style.shadow : null,
  };
}

function canonicalSectionDesign(value: unknown): JsonRecord {
  const design = record(value) ?? {};
  return {
    backgroundColor: nullableString(design.backgroundColor),
    textColor: nullableString(design.textColor),
    backgroundMediaId: nullableString(design.backgroundMediaId),
    backgroundOverlay: finiteNumber(design.backgroundOverlay, 0),
    backgroundFit: design.backgroundFit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: nonEmptyString(design.backgroundPosition, '50% 50%'),
    variant: ['off', 'custom', 'primary', 'secondary'].includes(string(design.variant))
      ? design.variant : 'custom',
    paddingTop: finiteNumber(design.paddingTop, 0),
    paddingBottom: finiteNumber(design.paddingBottom, 0),
    horizontalMargin: boolean(design.horizontalMargin, false),
    borderRadius: typeof design.borderRadius === 'number' ? design.borderRadius : null,
    borderWidth: finiteNumber(design.borderWidth, 0),
    borderColor: nullableString(design.borderColor),
    shadow: boolean(design.shadow, false),
    width: design.width === 'contained' ? 'contained' : 'full',
    mobileVisible: boolean(design.mobileVisible, true),
    headingStyle: typographyOverride(design.headingStyle),
    textStyle: typographyOverride(design.textStyle),
    linkStyle: linkStyleOverride(design.linkStyle),
  };
}

function richTextParagraph(text: string, heading = false): JsonRecord {
  return {
    size: heading ? 'large' : 'medium',
    fontFamily: null,
    alignment: 'left',
    runs: [{ text, ...(heading ? { marks: { bold: true } } : {}) }],
  };
}

function legacyTextDocument(content: JsonRecord): JsonRecord {
  const paragraphs: JsonRecord[] = [];
  const title = string(content.title);
  const body = string(content.body);
  if (title) paragraphs.push(richTextParagraph(title, true));
  body.split(/\r?\n/).forEach((line) => {
    if (line || body) paragraphs.push(richTextParagraph(line));
  });
  if (!paragraphs.length) paragraphs.push(richTextParagraph(''));
  return { type: 'rich-text-v1', paragraphs };
}

function serviceIds(content: JsonRecord): number[] | null {
  if (!Array.isArray(content.serviceIds)) return null;
  const source = content.serviceIds;
  if (!source.every((id) => Number.isInteger(id) && Number(id) > 0)) return null;
  const ids = source.map(Number);
  return ids.length <= 12 && new Set(ids).size === ids.length ? ids : null;
}

function canonicalBlock(
  value: unknown,
  context: PublicPageV2ConversionContext,
  path: string,
  actualManagedMediaIds: ReadonlySet<string>,
): JsonRecord[] {
  const block = record(value) ?? fail(context, path, 'block must be an object');
  const type = string(block.type);
  if (['hero', 'booking', 'socials', 'messengers'].includes(type) || ![
    'avatar', 'button', 'links', 'text', 'image', 'gallery', 'services',
    'contacts', 'social-button', 'map', 'divider', 'faq',
  ].includes(type)) return [];

  const content = record(block.content) ?? fail(context, `${path}.content`, 'content must be an object');
  const base = {
    id: string(block.id),
    name: string(block.name),
    visible: boolean(block.visible, true),
    design: canonicalBlockDesign(block.design),
  };
  const one = (canonicalContent: JsonRecord, canonicalType = type): JsonRecord[] => [{
    ...base, type: canonicalType, content: canonicalContent,
  }];

  if (type === 'avatar') {
    assertKeys(content, [
      'heading', 'subtitle', 'imageMediaId', 'imageUrl', 'imageAlt', 'layout', 'avatarSize',
      'coverColor', 'coverMediaId', 'coverUrl',
    ], context, `${path}.content`);
    const requestedImageMediaId = nullableString(content.imageMediaId);
    const requestedCoverMediaId = nullableString(content.coverMediaId);
    const imageMediaId = requestedImageMediaId && actualManagedMediaIds.has(requestedImageMediaId)
      ? requestedImageMediaId : null;
    const coverMediaId = requestedCoverMediaId && actualManagedMediaIds.has(requestedCoverMediaId)
      ? requestedCoverMediaId : null;
    const rawLayout = string(content.layout, 'centered');
    const layout = rawLayout === 'compact' ? 'cover-centered'
      : rawLayout === 'image-left' ? 'cover-left'
        : rawLayout === 'image-right' ? 'image-cover' : rawLayout;
    if (!['centered', 'cover-centered', 'cover-left', 'image-cover'].includes(layout)) {
      fail(context, `${path}.content.layout`, `unsupported avatar layout ${rawLayout}`);
    }
    const legacySize = rawLayout === 'compact' ? 65 : rawLayout === 'image-left' ? 125 : content.avatarSize;
    const avatarSize = [65, 95, 125, 150].includes(Number(legacySize)) ? Number(legacySize) : 150;
    return one({
      heading: string(content.heading), subtitle: string(content.subtitle),
      imageMediaId, imageAlt: string(content.imageAlt),
      layout, avatarSize, coverColor: nullableString(content.coverColor),
      coverMediaId,
    });
  }

  if (type === 'button') {
    assertKeys(content, ['label', 'icon', 'color', 'textColor', 'radius', 'action'], context, `${path}.content`);
    return one({
      label: string(content.label),
      icon: ['link', 'phone', 'email', 'message'].includes(string(content.icon)) ? content.icon : 'link',
      color: string(content.color), textColor: string(content.textColor), radius: finiteNumber(content.radius, 12),
      action: content.action,
    });
  }

  if (type === 'links') {
    assertKeys(content, ['links'], context, `${path}.content`);
    if (!Array.isArray(content.links)) fail(context, `${path}.content.links`, 'links must be an array');
    return one({ links: content.links.map((value, index) => {
      const item = record(value) ?? fail(context, `${path}.content.links.${index}`, 'link must be an object');
      assertKeys(item, ['id', 'label', 'action'], context, `${path}.content.links.${index}`);
      return { id: string(item.id), label: string(item.label), action: item.action };
    }) });
  }

  if (type === 'text') {
    assertKeys(content, ['document', 'title', 'body'], context, `${path}.content`);
    const hasDocument = Object.hasOwn(content, 'document');
    const hasLegacy = Object.hasOwn(content, 'title') || Object.hasOwn(content, 'body');
    if (hasDocument && hasLegacy) fail(context, `${path}.content`, 'ambiguous text formats');
    return one({ document: hasDocument ? content.document : legacyTextDocument(content) });
  }

  if (type === 'image') {
    assertKeys(content, ['imageMediaId', 'alt', 'url'], context, `${path}.content`);
    const requestedImageMediaId = nullableString(content.imageMediaId);
    const imageMediaId = requestedImageMediaId && actualManagedMediaIds.has(requestedImageMediaId)
      ? requestedImageMediaId : null;
    return one({ imageMediaId, alt: string(content.alt) });
  }

  if (type === 'gallery') {
    assertKeys(content, ['images'], context, `${path}.content`);
    if (!Array.isArray(content.images)) fail(context, `${path}.content.images`, 'images must be an array');
    const images = content.images.flatMap((value, index) => {
      const item = record(value) ?? fail(context, `${path}.content.images.${index}`, 'image must be an object');
      assertKeys(item, ['id', 'mediaId', 'alt', 'url'], context, `${path}.content.images.${index}`);
      const mediaId = nullableString(item.mediaId);
      return mediaId && actualManagedMediaIds.has(mediaId) ? [{ mediaId, alt: string(item.alt) }] : [];
    });
    return one({ images });
  }

  if (type === 'services') {
    assertKeys(content, [
      'title', 'serviceIds', 'services', 'autoplayIntervalSeconds', 'showBookingButton',
    ], context, `${path}.content`);
    if (Object.hasOwn(content, 'services')) return [];
    const ids = serviceIds(content);
    if (ids && ids.every((id) => context.ownedServiceIds.has(id))) {
      const interval = content.autoplayIntervalSeconds;
      return one({
        title: string(content.title), serviceIds: ids,
        autoplayIntervalSeconds: interval === null || interval === undefined ? null : interval,
        showBookingButton: boolean(content.showBookingButton, true),
      });
    }
    return [];
  }

  if (type === 'contacts') {
    assertKeys(content, ['title', 'contacts'], context, `${path}.content`);
    if (!Array.isArray(content.contacts)) fail(context, `${path}.content.contacts`, 'contacts must be an array');
    return one({
      title: string(content.title),
      contacts: content.contacts.map((value, index) => {
        const itemPath = `${path}.content.contacts.${index}`;
        const item = record(value) ?? fail(context, itemPath, 'contact must be an object');
        assertKeys(item, ['id', 'label', 'action', 'url'], context, itemPath);
        if (Object.hasOwn(item, 'action') && Object.hasOwn(item, 'url')) {
          fail(context, itemPath, 'ambiguous contact action');
        }
        const action = Object.hasOwn(item, 'action') ? canonicalAction(item.action) : contactUrlAction(item.url);
        if (!action) fail(context, Object.hasOwn(item, 'action') ? `${itemPath}.action` : `${itemPath}.url`, 'unsafe contact action');
        return { id: string(item.id), label: string(item.label), action };
      }),
    });
  }

  if (type === 'social-button') {
    assertKeys(content, ['platform', 'label', 'url'], context, `${path}.content`);
    return one({ platform: content.platform, label: string(content.label), url: content.url });
  }
  if (type === 'map') {
    assertKeys(content, ['title', 'address', 'label', 'url'], context, `${path}.content`);
    return one({
      title: string(content.title), address: string(content.address),
      label: string(content.label), url: string(content.url),
    });
  }
  if (type === 'divider') {
    assertKeys(content, [], context, `${path}.content`);
    return one({});
  }
  assertKeys(content, ['title', 'items'], context, `${path}.content`);
  if (!Array.isArray(content.items)) fail(context, `${path}.content.items`, 'items must be an array');
  return one({
    title: string(content.title),
    items: content.items.map((value, index) => {
      const itemPath = `${path}.content.items.${index}`;
      const item = record(value) ?? fail(context, itemPath, 'FAQ item must be an object');
      assertKeys(item, ['id', 'title', 'description'], context, itemPath);
      return { id: string(item.id), title: string(item.title), description: string(item.description) };
    }),
  });
}

function copyKnownObject(value: unknown, keys: readonly string[]): JsonRecord {
  const source = record(value) ?? {};
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));
}

function requiredTypography(value: unknown, fallback: JsonRecord): JsonRecord {
  const style = record(value) ?? {};
  return {
    fontFamily: nonEmptyString(style.fontFamily, string(fallback.fontFamily)),
    fontSize: finiteNumber(style.fontSize, Number(fallback.fontSize)),
    fontWeight: finiteNumber(style.fontWeight, Number(fallback.fontWeight)),
    fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
    color: nonEmptyString(style.color, string(fallback.color)),
  };
}

function themeTypographyToken(value: unknown, fontFamily: string, fontSize: number, fontWeight: number): JsonRecord {
  const token = record(value) ?? {};
  return {
    fontFamily: nonEmptyString(token.fontFamily, fontFamily),
    fontSize: finiteNumber(token.fontSize, fontSize),
    fontWeight: finiteNumber(token.fontWeight, fontWeight),
    lineHeight: finiteNumber(token.lineHeight, 1.4),
    letterSpacing: finiteNumber(token.letterSpacing, 0),
  };
}

function canonicalTheme(value: unknown): JsonRecord {
  const theme = record(value) ?? {};
  const colorsSource = record(theme.colors) ?? {};
  const colors = {
    background: nonEmptyString(colorsSource.background, '#ffffff'),
    surface: nonEmptyString(colorsSource.surface, '#ffffff'),
    text: nonEmptyString(colorsSource.text, '#111827'),
    primary: nonEmptyString(colorsSource.primary, '#2563eb'),
  };
  const fontFamily = nonEmptyString(theme.fontFamily, 'Inter, system-ui, sans-serif');
  const tokensSource = record(theme.tokens) ?? {};
  const tokenColors = record(tokensSource.colors) ?? {};
  const tokenTypography = record(tokensSource.typography) ?? {};
  const tokenLayout = record(tokensSource.layout) ?? {};
  const tokens = {
    colors: {
      contrast: nonEmptyString(tokenColors.contrast, '#ffffff'),
      linkTitle: nonEmptyString(tokenColors.linkTitle, colors.text),
      linkSubtitle: nonEmptyString(tokenColors.linkSubtitle, colors.text),
      linkShadow: nonEmptyString(tokenColors.linkShadow, '#00000033'),
      linkBorder: nonEmptyString(tokenColors.linkBorder, colors.primary),
      focus: nonEmptyString(tokenColors.focus, colors.primary),
      checkboxBackground: nonEmptyString(tokenColors.checkboxBackground, colors.primary),
    },
    typography: {
      fontFamily: nonEmptyString(tokenTypography.fontFamily, fontFamily),
      fontWeight: finiteNumber(tokenTypography.fontWeight, 400),
      boldFontWeight: finiteNumber(tokenTypography.boldFontWeight, 700),
      headingColor: nonEmptyString(tokenTypography.headingColor, colors.text),
      avatarTitle: themeTypographyToken(tokenTypography.avatarTitle, fontFamily, 24, 700),
      avatarBio: themeTypographyToken(tokenTypography.avatarBio, fontFamily, 16, 400),
      linkTitle: themeTypographyToken(tokenTypography.linkTitle, fontFamily, 16, 600),
      linkSubtitle: themeTypographyToken(tokenTypography.linkSubtitle, fontFamily, 14, 400),
      h1: themeTypographyToken(tokenTypography.h1, fontFamily, 48, 700),
      h2: themeTypographyToken(tokenTypography.h2, fontFamily, 32, 700),
      h3: themeTypographyToken(tokenTypography.h3, fontFamily, 24, 700),
      textLarge: themeTypographyToken(tokenTypography.textLarge, fontFamily, 20, 400),
      textMedium: themeTypographyToken(tokenTypography.textMedium, fontFamily, 16, 400),
      textSmall: themeTypographyToken(tokenTypography.textSmall, fontFamily, 14, 400),
    },
    layout: {
      blockRadius: finiteNumber(tokenLayout.blockRadius, 24),
      linkRadius: finiteNumber(tokenLayout.linkRadius, 24),
      linkGap: finiteNumber(tokenLayout.linkGap, 10),
    },
  };
  const fallbackHeading = {
    fontFamily, fontSize: 32, fontWeight: 700, fontStyle: 'normal', color: colors.text,
  };
  const fallbackText = {
    fontFamily, fontSize: 16, fontWeight: 400, fontStyle: 'normal', color: colors.text,
  };
  const styles = record(theme.styleDefaults) ?? {};
  const link = record(styles.linkStyle) ?? {};
  const fallbackLinkTitle = {
    fontFamily, fontSize: 16, fontWeight: 600, fontStyle: 'normal', color: colors.text,
  };
  const fallbackLinkSubtitle = {
    fontFamily, fontSize: 14, fontWeight: 400, fontStyle: 'normal', color: colors.text,
  };
  return {
    id: nonEmptyString(theme.id, 'default'),
    name: nonEmptyString(theme.name, 'Default'),
    swatches: Array.isArray(theme.swatches) && theme.swatches.length === 4
      && theme.swatches.every((swatch) => typeof swatch === 'string' && swatch.length > 0)
      ? theme.swatches : [colors.background, colors.primary, colors.surface, colors.text],
    colors,
    tokens,
    fontFamily,
    roundingStyle: ['rounded', 'pill', 'leaf', 'square'].includes(string(theme.roundingStyle))
      ? theme.roundingStyle : 'rounded',
    backgroundMediaId: nullableString(theme.backgroundMediaId),
    backgroundPreset: nullableString(theme.backgroundPreset),
    backgroundFit: theme.backgroundFit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: nonEmptyString(theme.backgroundPosition, '50% 50%'),
    linkStylePreset: [
      'primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline',
      'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong',
    ].includes(string(theme.linkStylePreset)) ? theme.linkStylePreset : 'primary-fill',
    styleDefaults: {
      sectionBorderRadius: finiteNumber(styles.sectionBorderRadius, 0),
      blockBorderRadius: finiteNumber(styles.blockBorderRadius, 24),
      headingStyle: requiredTypography(styles.headingStyle, fallbackHeading),
      textStyle: requiredTypography(styles.textStyle, fallbackText),
      linkStyle: {
        titleStyle: requiredTypography(link.titleStyle, fallbackLinkTitle),
        subtitleStyle: requiredTypography(link.subtitleStyle, fallbackLinkSubtitle),
        backgroundColor: nonEmptyString(link.backgroundColor, colors.surface),
        backgroundOpacity: finiteNumber(link.backgroundOpacity, 1),
        borderWidth: finiteNumber(link.borderWidth, 0),
        borderColor: nonEmptyString(link.borderColor, 'transparent'),
        shadow: boolean(link.shadow, false),
      },
    },
  };
}

function parseConverted(
  value: unknown,
  context: PublicPageV2ConversionContext,
): FrozenPublicPageDocumentV2 {
  const parsed = frozenPublicPageDocumentV2Schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(context, issue?.path.length ? issue.path.join('.') : '$', issue?.message ?? 'invalid v2 document');
  }
  return parsed.data;
}

function sanitizeDocumentMediaReferences(
  document: FrozenPublicPageDocumentV2,
  context: PublicPageV2ConversionContext,
): FrozenPublicPageDocumentV2 {
  const mediaIds = new Set(document.media.map(({ id }) => id));
  const sanitize = (mediaId: string | null) => mediaId && mediaIds.has(mediaId) ? mediaId : null;
  const sections = document.sections.map((section) => ({
    ...section,
    design: { ...section.design, backgroundMediaId: sanitize(section.design.backgroundMediaId) },
    blocks: section.blocks.map((block) => {
      const canonicalBlock = {
        ...block,
        design: { ...block.design, backgroundMediaId: sanitize(block.design.backgroundMediaId) },
      };
      if (block.type === 'avatar') {
        return {
          ...canonicalBlock,
          content: {
            ...block.content,
            imageMediaId: sanitize(block.content.imageMediaId),
            coverMediaId: sanitize(block.content.coverMediaId),
          },
        };
      }
      if (block.type === 'image') {
        return {
          ...canonicalBlock,
          content: { ...block.content, imageMediaId: sanitize(block.content.imageMediaId) },
        };
      }
      if (block.type === 'gallery') {
        return {
          ...canonicalBlock,
          content: {
            ...block.content,
            images: block.content.images.filter(({ mediaId }) => mediaIds.has(mediaId)),
          },
        };
      }
      return canonicalBlock;
    }),
  }));
  return parseConverted({
    ...document,
    profile: {
      ...document.profile,
      logoMediaId: sanitize(document.profile.logoMediaId),
      avatarMediaId: sanitize(document.profile.avatarMediaId),
    },
    theme: { ...document.theme, backgroundMediaId: sanitize(document.theme.backgroundMediaId) },
    sections,
    seo: { ...document.seo, imageMediaId: sanitize(document.seo.imageMediaId) },
  }, context);
}

export function convertPublicPageDocumentToSchemaV2(
  input: unknown,
  context: PublicPageV2ConversionContext,
): PublicPageV2ConversionResult {
  const source = record(input) ?? fail(context, '$', 'document must be an object');
  if (source.schemaVersion === MIGRATION_PUBLIC_PAGE_SCHEMA_VERSION) {
    const parsed = parseConverted(source, context);
    return {
      document: sanitizeDocumentMediaReferences(parsed, context),
      wasAlreadyV2: true,
    };
  }
  if (source.schemaVersion !== undefined && source.schemaVersion !== 1) {
    fail(context, 'schemaVersion', `unsupported schema version ${String(source.schemaVersion)}`);
  }
  if (!Array.isArray(source.media)) fail(context, 'media', 'media must be an array');
  const media = source.media.map((value, index) => {
    const itemPath = `media.${index}`;
    const item = record(value) ?? fail(context, itemPath, 'media must be an object');
    const canonical = copyKnownObject(item, ['id', 'url', 'mimeType', 'alt', 'width', 'height']);
    const parsed = mediaItemSchema.safeParse(canonical);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      fail(
        context,
        issue?.path.length ? `${itemPath}.${issue.path.join('.')}` : itemPath,
        issue?.message ?? 'invalid media',
      );
    }
    return parsed.data;
  });
  const actualManagedMediaIds = new Set(media.map(({ id }) => id));
  if (!Array.isArray(source.sections)) fail(context, 'sections', 'sections must be an array');
  const usedIds = new Set<string>();
  const sections = source.sections.map((sectionValue, sectionIndex) => {
    const sectionPath = `sections.${sectionIndex}`;
    const section = record(sectionValue) ?? fail(context, sectionPath, 'section must be an object');
    if (!Array.isArray(section.blocks)) fail(context, `${sectionPath}.blocks`, 'blocks must be an array');
    const blocks = section.blocks.flatMap((block, blockIndex) => canonicalBlock(
      block, context, `${sectionPath}.blocks.${blockIndex}`, actualManagedMediaIds,
    ));
    blocks.forEach((block) => {
      const id = string(block.id);
      if (!id || usedIds.has(id)) fail(context, `${sectionPath}.blocks`, `duplicate generated block id ${id}`);
      usedIds.add(id);
    });
    return {
      id: string(section.id), name: string(section.name), visible: boolean(section.visible, true),
      layout: section.layout, blocks, design: canonicalSectionDesign(section.design),
    };
  });

  const profile = copyKnownObject(source.profile, ['displayName', 'description', 'logoMediaId', 'avatarMediaId']);
  const theme = canonicalTheme(source.theme);
  const seo = copyKnownObject(source.seo, ['title', 'description', 'imageMediaId']);
  const converted = {
    schemaVersion: MIGRATION_PUBLIC_PAGE_SCHEMA_VERSION,
    id: source.id,
    slug: source.slug,
    status: source.status,
    profile,
    theme,
    sections,
    seo,
    media,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
  const parsed = parseConverted(converted, context);
  return {
    document: sanitizeDocumentMediaReferences(parsed, context),
    wasAlreadyV2: false,
  };
}

export function convertPublicPageSnapshotsToSchemaV2(
  row: { id: string; account_id: number; draft_document: unknown; published_document: unknown | null },
  ownedServiceIds: ReadonlySet<number>,
): {
  draftDocument: FrozenPublicPageDocumentV2;
  publishedDocument: FrozenPublicPageDocumentV2 | null;
} {
  const draft = convertPublicPageDocumentToSchemaV2(row.draft_document, {
    pageId: row.id, accountId: row.account_id, snapshot: 'draft_document', ownedServiceIds,
  });
  const published = row.published_document === null ? null : convertPublicPageDocumentToSchemaV2(
    row.published_document,
    { pageId: row.id, accountId: row.account_id, snapshot: 'published_document', ownedServiceIds },
  );
  return {
    draftDocument: draft.document,
    publishedDocument: published?.document ?? null,
  };
}

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const rows = await trx('public_pages').select<{
      id: string;
      account_id: number;
      draft_document: unknown;
      published_document: unknown | null;
    }[]>('id', 'account_id', 'draft_document', 'published_document').forUpdate();
    const convertedRows: Array<{
      row: typeof rows[number];
      draftDocument: FrozenPublicPageDocumentV2;
      publishedDocument: FrozenPublicPageDocumentV2 | null;
    }> = [];
    for (const row of rows) {
      const services = await trx('services').where({ account_id: row.account_id }).select<{ id: number }[]>('id');
      const converted = convertPublicPageSnapshotsToSchemaV2(row, new Set(services.map(({ id }) => id)));
      convertedRows.push({ row, ...converted });
    }
    for (const converted of convertedRows) {
      const { row } = converted;
      await trx('public_pages').where({ id: row.id, account_id: row.account_id }).update({
        draft_document: converted.draftDocument,
        published_document: converted.publishedDocument,
      });
    }
    await trx.raw(`
      ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v2_check
      CHECK (draft_document @> '{"schemaVersion": 2}'::jsonb)
    `);
    await trx.raw(`
      ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_published_document_schema_v2_check
      CHECK (published_document IS NULL OR published_document @> '{"schemaVersion": 2}'::jsonb)
    `);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v2 migration is forward-only');
}
