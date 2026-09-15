import { z } from 'zod';

export const PUBLIC_PAGE_SCHEMA_VERSION = 4 as const;
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
const percentagePositionSchema = z.string().regex(
  /^(?:0|[1-9]\d?|100)% (?:0|[1-9]\d?|100)%$/,
  'invalid_percentage_position',
);
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
    avatarPosition: percentagePositionSchema,
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
  const mediaIds = new Set(document.media.map(({ id }) => id));
  const visitArchived = (value: unknown, path: PropertyKey[]) => {
    if (Array.isArray(value)) value.forEach((item, index) => visitArchived(item, [...path, index]));
    else if (typeof value === 'object' && value !== null) Object.entries(value).forEach(([key, item]) => {
      if (/mediaId$/i.test(key) && item !== null && (typeof item !== 'string' || !mediaIds.has(item))) {
        ctx.addIssue({ code: 'custom', path: [...path, key], message: 'missing_media' });
      }
      visitArchived(item, [...path, key]);
    });
  };
  visitArchived(document.archivedBlocks, ['archivedBlocks']);
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

export type PublicPageDocument = z.infer<typeof publicPageDocumentSchema>;

export const savePublicPageDraftSchema = z.object({
  document: z.unknown(),
  expectedRevision: z.number().int().nonnegative(),
}).strict();
export const createPublicPageSchema = z.object({
  document: z.unknown(),
}).strict();
export const publicPageRevisionSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
}).strict();
export const publicPageListStatusSchema = z.enum(['active', 'draft', 'published', 'archived', 'all']);

const optionalContact = z.string().trim().max(320).optional();
export const publicBookingSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: optionalContact.refine((value) => !value || z.email().safeParse(value).success),
  phone: optionalContact.refine((value) => !value || /^\+?[0-9 ()-]{7,30}$/.test(value)),
  telegramUsername: z.string().trim().max(64).optional(),
  specialistId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  startAt: z.iso.datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(100).refine(isIanaTimezone).optional(),
  meetingProvider: z.enum(['manual', 'zoom', 'offline']).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.email?.trim() && !value.phone?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_or_phone_required' });
  }
});

export const publicAppointmentStatusQuerySchema = z.object({
  specialistLastName: z.string().trim().min(1).max(100),
}).strict();

export function normalizePublicPageSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidPublicPageSlug(value: string): boolean {
  const slug = normalizePublicPageSlug(value);
  return slug.length >= 3 && slug.length <= 40
    && slugPattern.test(slug) && !RESERVED_PUBLIC_PAGE_SLUGS.has(slug);
}

export type PublishIssue = { code: string; path: string; detail?: string; blockId?: string };

function hasRichTextContent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  if (document.type !== 'rich-text-v1') return false;
  const paragraphs = document.paragraphs;
  return Array.isArray(paragraphs) && paragraphs.some((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object') return false;
    const runs = (paragraph as Record<string, unknown>).runs;
    return Array.isArray(runs) && runs.some((run) => run && typeof run === 'object'
      && typeof (run as Record<string, unknown>).text === 'string'
      && Boolean(((run as Record<string, unknown>).text as string).trim()));
  });
}

function isSafeHref(value: unknown, kind: 'contact' | 'web'): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const href = value.trim();
  if (/^https?:\/\//i.test(href)) {
    try {
      return ['http:', 'https:'].includes(new URL(href).protocol);
    } catch {
      return false;
    }
  }
  if (kind === 'contact' && /^mailto:/i.test(href)) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href.slice(7).trim());
  }
  if (kind === 'contact' && /^tel:/i.test(href)) {
    return /^\+?[1-9]\d{6,14}$/.test(href.slice(4).trim().replace(/\D/g, ''));
  }
  return false;
}

function validateKnownBlock(block: PublicPageDocument['sections'][number]['blocks'][number]): string[] {
  switch (block.type) {
    case 'avatar': return [
      ...(!block.content.heading.trim() ? ['heading is required'] : []),
      ...(!block.content.imageMediaId ? ['imageMediaId is required'] : []),
      ...(!block.content.imageAlt.trim() ? ['imageAlt is required'] : []),
    ];
    case 'button': return block.content.label.trim() ? [] : ['label is required'];
    case 'links': return block.content.links.flatMap((item, index) => (
      item.label.trim() ? [] : [`links.${index}.label is required`]
    ));
    case 'text': return hasRichTextContent(block.content.document) ? [] : ['document is required'];
    case 'image': return [
      ...(!block.content.imageMediaId ? ['imageMediaId is required'] : []),
      ...(!block.content.alt.trim() ? ['alt is required'] : []),
    ];
    case 'gallery': return block.content.images.flatMap((item, index) => (
      item.alt.trim() ? [] : [`images.${index}.alt is required`]
    ));
    case 'services': return block.content.serviceIds.length > 0
      ? [] : ['serviceIds must contain at least one service'];
    case 'contacts': return block.content.contacts.length > 0
      ? block.content.contacts.flatMap((item, index) => (
        item.label.trim() ? [] : [`contacts.${index}.label is required`]
      ))
      : ['contacts must contain at least one contact'];
    case 'social-button': return [
      ...(!block.content.label.trim() ? ['label is required'] : []),
      ...(isSafeHref(block.content.url, 'web') ? [] : ['url is unsafe']),
    ];
    case 'map': return [
      ...(!block.content.address.trim() ? ['address is required'] : []),
      ...(!block.content.url.trim() ? ['url is required'] : []),
      ...(isSafeHref(block.content.url, 'web') ? [] : ['url is unsafe']),
    ];
    case 'divider': return [];
    case 'faq': return block.content.items.flatMap((item, index) => [
      ...(!item.title.trim() ? [`items.${index}.title is required`] : []),
      ...(!item.description.trim() ? [`items.${index}.description is required`] : []),
    ]);
  }
}

export function validatePublicPageForPublish(document: PublicPageDocument): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (!isValidPublicPageSlug(document.slug)) issues.push({ code: 'invalid_slug', path: 'slug' });
  if (!document.seo.title.trim()) issues.push({ code: 'missing_seo_title', path: 'seo.title' });
  if (!document.seo.description.trim()) issues.push({ code: 'missing_seo_description', path: 'seo.description' });
  const visible = document.sections.filter((section) => section.visible)
    .flatMap((section) => section.blocks.filter((block) => block.visible));
  const socialPlatforms = new Set<string>();
  document.sections.flatMap((section) => section.blocks).forEach((block) => {
    if (block.type !== 'social-button' || typeof block.content.platform !== 'string') return;
    if (socialPlatforms.has(block.content.platform)) {
      issues.push({
        code: 'invalid_block',
        path: `blocks.${block.id}`,
        detail: 'duplicate_social_platform',
        blockId: block.id,
      });
    }
    socialPlatforms.add(block.content.platform);
  });
  if (visible.length === 0) issues.push({ code: 'missing_visible_block', path: 'sections' });
  for (const block of visible) {
    for (const detail of validateKnownBlock(block)) {
      issues.push({ code: 'invalid_block', path: `blocks.${block.id}`, detail });
    }
  }
  document.media.forEach((media, index) => {
    let isAbsoluteHttpsUrl = false;
    try {
      const url = new URL(media.url);
      isAbsoluteHttpsUrl = /^https:\/\//i.test(media.url) && url.protocol === 'https:' && Boolean(url.hostname);
    } catch {
      // Publish validation reports all malformed and non-absolute URLs uniformly.
    }
    if (!isAbsoluteHttpsUrl) {
      issues.push({
        code: 'invalid_media',
        path: `media.${index}.url`,
        detail: 'https_url_required',
      });
    }
    if (!media.alt.trim()) issues.push({ code: 'missing_alt', path: `media.${index}.alt` });
  });
  const mediaIds = new Set(document.media.map((media) => media.id));
  const isCtaAction = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null || !('type' in value)) return false;
    const action = value as Record<string, unknown>;
    return ((action.type === 'url' || action.type === 'messenger') && typeof action.url === 'string')
      || (action.type === 'phone' && typeof action.phone === 'string')
      || (action.type === 'email' && typeof action.email === 'string');
  };
  const isSafeCtaAction = (value: unknown): boolean => {
    if (!isCtaAction(value)) return false;
    const action = value as Record<string, unknown>;
    if (action.type === 'url' || action.type === 'messenger') return isSafeHref(action.url, 'web');
    if (action.type === 'phone') {
      return /^\+?[1-9]\d{6,14}$/.test(String(action.phone).trim().replace(/\D/g, ''));
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(action.email).trim());
  };
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (isCtaAction(record) && !isSafeCtaAction(record)) {
      issues.push({ code: 'invalid_cta', path });
    }
    if (typeof record.label === 'string' && 'action' in record
      && isCtaAction(record.action) && !record.label.trim()) {
      issues.push({ code: 'missing_accessible_label', path: `${path}.label` });
    }
    Object.entries(record).forEach(([key, item]) => {
      if (key === 'action' && !isCtaAction(item)) {
        issues.push({ code: 'invalid_cta', path: `${path}.${key}` });
      }
      if (/mediaId$/i.test(key) && item !== null && (typeof item !== 'string' || !mediaIds.has(item))) {
        issues.push({ code: 'missing_media', path: `${path}.${key}` });
      }
      visit(item, `${path}.${key}`);
    });
  };
  visit(document.profile, 'profile');
  visit(document.theme, 'theme');
  visit(document.seo, 'seo');
  document.sections.forEach((section, index) => {
    visit(section.design, `sections.${index}.design`);
  });
  visible.forEach((block) => {
    visit(block.design, `blocks.${block.id}.design`);
    visit(block.content, `blocks.${block.id}.content`);
  });
  return issues;
}
