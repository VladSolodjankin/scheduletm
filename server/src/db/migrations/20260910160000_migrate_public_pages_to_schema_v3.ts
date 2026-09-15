import type { Knex } from 'knex';
import { z } from 'zod';
// Frozen schema: this forward migration must not import the changing runtime contract.

export const PUBLIC_PAGE_SCHEMA_VERSION = 3 as const;
export function isIanaTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
  catch { return false; }
}
export const KNOWN_PUBLIC_PAGE_BLOCKS = new Set([
  'avatar', 'button', 'links', 'text', 'image', 'gallery', 'services',
  'contacts', 'social-button', 'map', 'divider', 'faq',
]);
export const RESERVED_PUBLIC_PAGE_SLUGS = new Set([
  'api', 'appointments', 'assets', 'booking', 'health', 'login', 'logout',
  'public-pages', 'register', 'settings', 'specialists', 'users',
]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const socialButtonPlatformValues = [
  'facebook-messenger', 'vk', 'whatsapp', 'viber', 'telegram',
  'facebook', 'threads', 'instagram', 'tiktok',
] as const;
const ctaActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url'), url: z.string() }).strict(),
  z.object({ type: z.literal('phone'), phone: z.string() }).strict(),
  z.object({ type: z.literal('email'), email: z.string() }).strict(),
  z.object({ type: z.literal('messenger'), url: z.string() }).strict(),
]);
const socialButtonContentSchema = z.object({
  platform: z.enum(socialButtonPlatformValues),
  label: z.string().trim().min(1),
  url: z.url().refine((url) => {
    try {
      return ['http:', 'https:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  }),
}).strict();
const servicesCatalogContentSchema = z.object({
  title: z.string(),
  serviceIds: z.array(z.number().int().positive()).max(12).refine(
    (serviceIds) => new Set(serviceIds).size === serviceIds.length,
    { message: 'duplicate_service_id' },
  ),
  autoplayIntervalSeconds: z.number().int().min(3).max(30).nullable(),
  showBookingButton: z.boolean(),
}).strict();

const richTextMarksSchema = z.object({
  bold: z.literal(true).optional(),
  italic: z.literal(true).optional(),
  underline: z.literal(true).optional(),
  strike: z.literal(true).optional(),
  color: z.string().min(1).optional(),
}).strict();
const richTextRunSchema = z.object({
  text: z.string(),
  marks: richTextMarksSchema.optional(),
}).strict();
const richTextParagraphSchema = z.object({
  size: z.enum(['small', 'medium', 'large', 'h1', 'h2', 'h3']),
  fontFamily: z.string().min(1).nullable(),
  alignment: z.enum(['left', 'center', 'right', 'justify']),
  runs: z.array(richTextRunSchema).min(1),
}).strict();
const richTextDocumentSchema = z.object({
  type: z.literal('rich-text-v1'),
  paragraphs: z.array(richTextParagraphSchema).min(1),
}).strict();

const nullableString = z.string().nullable();
const typographyStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.number().min(8).max(96),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(['normal', 'italic']),
  color: z.string().min(1),
}).strict();
const typographyOverrideSchema = z.object({
  fontFamily: nullableString,
  fontSize: z.number().min(8).max(96).nullable(),
  fontWeight: z.number().int().min(100).max(900).nullable(),
  fontStyle: z.enum(['normal', 'italic']).nullable(),
  color: nullableString,
}).strict();
const linkStyleSchema = z.object({
  titleStyle: typographyStyleSchema,
  subtitleStyle: typographyStyleSchema,
  backgroundColor: z.string().min(1),
  backgroundOpacity: z.number().min(0).max(1),
  borderWidth: z.number().min(0).max(16),
  borderColor: z.string().min(1),
  shadow: z.boolean(),
}).strict();
const linkStyleOverrideSchema = z.object({
  titleStyle: typographyOverrideSchema,
  subtitleStyle: typographyOverrideSchema,
  backgroundColor: nullableString,
  backgroundOpacity: z.number().min(0).max(1).nullable(),
  borderWidth: z.number().min(0).max(16).nullable(),
  borderColor: nullableString,
  shadow: z.boolean().nullable(),
}).strict();
const themeStyleDefaultsSchema = z.object({
  sectionBorderRadius: z.number().min(0).max(100),
  blockBorderRadius: z.number().min(0).max(100),
  headingStyle: typographyStyleSchema,
  textStyle: typographyStyleSchema,
  linkStyle: linkStyleSchema,
}).strict();
const blockDesignSchema = z.object({
  linkStyle: linkStyleOverrideSchema.nullable(),
  animation: z.enum(['none', 'pulse', 'lift']),
  backgroundColor: nullableString,
  textColor: nullableString,
  backgroundMediaId: nullableString,
  backgroundOverlay: z.number().min(0).max(1),
  backgroundFit: z.enum(['cover', 'contain']),
  backgroundPosition: z.string().min(1),
  paddingTop: z.number().min(0).max(160),
  paddingBottom: z.number().min(0).max(160),
  borderRadius: z.number().min(0).max(100).nullable(),
}).strict();
const blockFields = {
  schedule: z.object({
    period: z.object({
      startAt: z.iso.datetime(), endAt: z.iso.datetime(),
    }).strict().refine((period) => Date.parse(period.startAt) < Date.parse(period.endAt), 'invalid_schedule_period').nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7)
      .refine((days) => new Set(days).size === days.length, 'duplicate_weekday').nullable(),
  }).strict(),
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  design: blockDesignSchema,
};
const blockSchema = z.discriminatedUnion('type', [
  z.object({ ...blockFields, type: z.literal('avatar'), content: z.object({
    heading: z.string(),
    subtitle: z.string(),
    imageMediaId: nullableString,
    imageAlt: z.string(),
    layout: z.enum(['centered', 'cover-centered', 'cover-left', 'image-cover']),
    avatarSize: z.union([z.literal(65), z.literal(95), z.literal(125), z.literal(150)]),
    coverColor: nullableString,
    coverMediaId: nullableString,
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('button'), content: z.object({
    label: z.string(),
    icon: z.enum(['link', 'phone', 'email', 'message']),
    subtitle: z.string(),
    openInNewTab: z.boolean(),
    action: ctaActionSchema,
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('links'), content: z.object({
    links: z.array(z.object({
      id: z.string().min(1),
      label: z.string(),
      action: ctaActionSchema,
    }).strict()),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('text'), content: z.object({
    document: richTextDocumentSchema,
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('image'), content: z.object({
    imageMediaId: nullableString,
    alt: z.string(),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('gallery'), content: z.object({
    images: z.array(z.object({
      mediaId: z.string().min(1),
      alt: z.string(),
    }).strict()),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('services'), content: servicesCatalogContentSchema }).strict(),
  z.object({ ...blockFields, type: z.literal('contacts'), content: z.object({
    title: z.string(),
    contacts: z.array(z.object({
      id: z.string().min(1),
      label: z.string(),
      action: ctaActionSchema,
    }).strict()),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('social-button'), content: socialButtonContentSchema }).strict(),
  z.object({ ...blockFields, type: z.literal('map'), content: z.object({
    title: z.string(),
    address: z.string(),
    label: z.string(),
    url: z.string(),
  }).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('divider'), content: z.object({}).strict() }).strict(),
  z.object({ ...blockFields, type: z.literal('faq'), content: z.object({
    title: z.string(),
    items: z.array(z.object({
      id: z.string().min(1),
      title: z.string(),
      description: z.string(),
    }).strict()),
  }).strict() }).strict(),
]);
const sectionDesignSchema = z.object({
  backgroundColor: nullableString,
  textColor: nullableString,
  backgroundMediaId: nullableString,
  backgroundOverlay: z.number().min(0).max(1),
  backgroundFit: z.enum(['cover', 'contain']),
  backgroundPosition: z.string().min(1),
  variant: z.enum(['off', 'custom', 'primary', 'secondary']),
  paddingTop: z.number().min(0).max(160),
  paddingBottom: z.number().min(0).max(160),
  horizontalMargin: z.boolean(),
  borderRadius: z.number().min(0).max(100).nullable(),
  borderWidth: z.number().min(0).max(16),
  borderColor: nullableString,
  shadow: z.boolean(),
  width: z.enum(['full', 'contained']),
  mobileVisible: z.boolean(),
  headingStyle: typographyOverrideSchema,
  textStyle: typographyOverrideSchema,
  linkStyle: linkStyleOverrideSchema,
}).strict();
const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  layout: z.enum([
    'single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third',
    'three-equal', 'stack', 'hero-overlay',
  ]),
  blocks: z.array(blockSchema),
  design: sectionDesignSchema,
}).strict();
const mediaSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  alt: z.string(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
}).strict();
const themeTypographyTokenSchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.number().min(8).max(96),
  fontWeight: z.number().int().min(100).max(900),
  lineHeight: z.number().min(0.5).max(3),
  letterSpacing: z.number().min(-10).max(20),
}).strict();
const themeTokensSchema = z.object({
  colors: z.object({
    contrast: z.string().min(1),
    linkTitle: z.string().min(1),
    linkSubtitle: z.string().min(1),
    linkShadow: z.string().min(1),
    linkBorder: z.string().min(1),
    focus: z.string().min(1),
    checkboxBackground: z.string().min(1),
  }).strict(),
  typography: z.object({
    fontFamily: z.string().min(1),
    fontWeight: z.number().int().min(100).max(900),
    boldFontWeight: z.number().int().min(100).max(900),
    headingColor: z.string().min(1),
    avatarTitle: themeTypographyTokenSchema,
    avatarBio: themeTypographyTokenSchema,
    linkTitle: themeTypographyTokenSchema,
    linkSubtitle: themeTypographyTokenSchema,
    h1: themeTypographyTokenSchema,
    h2: themeTypographyTokenSchema,
    h3: themeTypographyTokenSchema,
    textLarge: themeTypographyTokenSchema,
    textMedium: themeTypographyTokenSchema,
    textSmall: themeTypographyTokenSchema,
  }).strict(),
  layout: z.object({
    blockRadius: z.number().min(0).max(100),
    linkRadius: z.number().min(0).max(100),
    linkGap: z.number().min(0).max(100),
  }).strict(),
}).strict();
const themeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  swatches: z.tuple([
    z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1),
  ]),
  colors: z.object({
    background: z.string().min(1),
    surface: z.string().min(1),
    text: z.string().min(1),
    primary: z.string().min(1),
  }).strict(),
  tokens: themeTokensSchema,
  fontFamily: z.string().min(1),
  roundingStyle: z.enum(['rounded', 'pill', 'leaf', 'square']),
  backgroundMediaId: nullableString,
  backgroundPreset: nullableString,
  backgroundFit: z.enum(['cover', 'contain']),
  backgroundPosition: z.string().min(1),
  linkStylePreset: z.enum([
    'primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline',
    'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong',
  ]),
  styleDefaults: themeStyleDefaultsSchema,
}).strict();

export const publicPageDocumentSchema = z.object({
  timezone: z.string().min(1).max(64).refine(isIanaTimezone),
  archivedBlocks: z.array(z.object({ block: blockSchema, sourceSectionId: z.string().min(1) }).strict()),
  schemaVersion: z.literal(PUBLIC_PAGE_SCHEMA_VERSION),
  id: z.string().min(1).max(128),
  slug: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  profile: z.object({
    displayName: z.string(),
    description: z.string(),
    logoMediaId: nullableString,
    avatarMediaId: nullableString,
  }).strict(),
  theme: themeSchema,
  sections: z.array(sectionSchema),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    imageMediaId: nullableString,
  }).strict(),
  media: z.array(mediaSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).strict().superRefine((document, ctx) => {
  const ids = [document.id, ...document.sections.flatMap((section) => [
    section.id, ...section.blocks.map((block) => block.id),
  ]), ...document.archivedBlocks.map(({ block }) => block.id), ...document.media.map((media) => media.id)];
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: 'duplicate_id' });
  }
  const socialPlatforms = new Set<string>();
  document.sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      if (block.type !== 'social-button') return;
      if (socialPlatforms.has(block.content.platform)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', sectionIndex, 'blocks', blockIndex, 'content', 'platform'],
          message: 'duplicate_social_platform',
        });
      }
      socialPlatforms.add(block.content.platform);
    });
  });
});

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected object');
  return value as JsonObject;
}

export function convertPublicPageDocumentToSchemaV3(input: unknown, timezone: string) {
  const source = object(input);
  if (source.schemaVersion !== 2) throw new Error(`Expected schemaVersion 2, received ${String(source.schemaVersion)}`);
  if (!isIanaTimezone(timezone)) throw new Error(`Invalid account timezone: ${timezone}`);
  if (!Array.isArray(source.sections)) throw new Error('Expected sections array');
  const typography = { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null };
  const sections = source.sections.map((value) => {
    const section = object(value);
    if (!Array.isArray(section.blocks)) throw new Error('Expected blocks array');
    return { ...section, blocks: section.blocks.map((value) => {
      const block = object(value);
      let content = object(block.content);
      let linkStyle: z.infer<typeof linkStyleOverrideSchema> | null = null;
      if (block.type === 'button') {
        const { color, textColor, radius: _radius, ...rest } = content;
        if (typeof color !== 'string' || typeof textColor !== 'string') throw new Error('Invalid v2 button colors');
        if (color || textColor) linkStyle = {
          titleStyle: { ...typography, color: textColor || null }, subtitleStyle: { ...typography },
          backgroundColor: color || null, backgroundOpacity: color ? 1 : null,
          borderWidth: null, borderColor: null, shadow: null,
        };
        content = { ...rest, subtitle: '', openInNewTab: true };
      }
      return { ...block, content, schedule: { period: null, weekdays: null },
        design: { ...object(block.design), linkStyle, animation: 'none' } };
    }) };
  });
  const theme = structuredClone(object(source.theme));
  if (theme.roundingStyle === 'square' || theme.roundingStyle === 'pill') {
    const radius = theme.roundingStyle === 'square' ? 2 : 40;
    const tokens = object(theme.tokens);
    tokens.layout = { ...object(tokens.layout), linkRadius: radius };
    theme.styleDefaults = { ...object(theme.styleDefaults), sectionBorderRadius: radius, blockBorderRadius: radius };
  }
  return publicPageDocumentSchema.parse({ ...source, theme, schemaVersion: 3, timezone, archivedBlocks: [], sections });
}

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const rows = await trx('public_pages as p').leftJoin('account_settings as s', 's.account_id', 'p.account_id')
      .select<{ id: string; account_id: number; draft_document: unknown; published_document: unknown | null; timezone: string | null }[]>(
        'p.id', 'p.account_id', 'p.draft_document', 'p.published_document', 's.timezone',
      ).forUpdate('p');
    const converted = rows.map((row) => {
      const timezone = row.timezone?.trim() || 'UTC';
      const convert = (snapshot: 'draft_document' | 'published_document') => {
        if (snapshot === 'published_document' && row[snapshot] === null) return null;
        try { return convertPublicPageDocumentToSchemaV3(row[snapshot], timezone); }
        catch (error) { throw new Error(`Public Page ${row.id} ${snapshot}: ${error instanceof Error ? error.message : String(error)}`); }
      };
      return { row, draft: convert('draft_document'), published: convert('published_document') };
    });
    await trx.raw('ALTER TABLE public_pages DROP CONSTRAINT public_pages_draft_document_schema_v2_check, DROP CONSTRAINT public_pages_published_document_schema_v2_check');
    for (const item of converted) {
      await trx('public_pages').where({ id: item.row.id, account_id: item.row.account_id }).update({
        draft_document: item.draft, published_document: item.published,
      });
    }
    await trx.raw(`ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v3_check CHECK (draft_document @> '{"schemaVersion":3}'::jsonb),
      ADD CONSTRAINT public_pages_published_document_schema_v3_check CHECK (published_document IS NULL OR published_document @> '{"schemaVersion":3}'::jsonb)`);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v3 migration is forward-only');
}

