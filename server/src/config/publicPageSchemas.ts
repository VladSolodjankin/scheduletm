import { z } from 'zod';

export const PUBLIC_PAGE_SCHEMA_VERSION = 1 as const;
export const KNOWN_PUBLIC_PAGE_BLOCKS = new Set([
  'hero', 'avatar', 'button', 'links', 'booking', 'text', 'image', 'gallery', 'services',
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
const socialButtonPlatforms = new Set<string>(socialButtonPlatformValues);
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

const nullableString = z.string().nullable();
const typographyStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number().min(8).max(96),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(['normal', 'italic']),
  color: z.string(),
}).passthrough();
const typographyOverrideSchema = z.object({
  fontFamily: nullableString.default(null),
  fontSize: z.number().min(8).max(96).nullable().default(null),
  fontWeight: z.number().int().min(100).max(900).nullable().default(null),
  fontStyle: z.enum(['normal', 'italic']).nullable().default(null),
  color: nullableString.default(null),
}).passthrough();
const emptyTypographyOverride = {
  fontFamily: null,
  fontSize: null,
  fontWeight: null,
  fontStyle: null,
  color: null,
};
const linkStyleSchema = z.object({
  titleStyle: typographyStyleSchema,
  subtitleStyle: typographyStyleSchema,
  backgroundColor: z.string(),
  backgroundOpacity: z.number().min(0).max(1),
  borderWidth: z.number().min(0).max(16),
  borderColor: z.string(),
  shadow: z.boolean(),
}).passthrough();
const linkStyleOverrideSchema = z.object({
  titleStyle: typographyOverrideSchema.default(emptyTypographyOverride),
  subtitleStyle: typographyOverrideSchema.default(emptyTypographyOverride),
  backgroundColor: nullableString.default(null),
  backgroundOpacity: z.number().min(0).max(1).nullable().default(null),
  borderWidth: z.number().min(0).max(16).nullable().default(null),
  borderColor: nullableString.default(null),
  shadow: z.boolean().nullable().default(null),
}).passthrough();
const defaultThemeStyleDefaults = (fontFamily: string, textColor: string, surfaceColor: string) => ({
  sectionBorderRadius: 0,
  blockBorderRadius: 24,
  headingStyle: {
    fontFamily,
    fontSize: 32,
    fontWeight: 700,
    fontStyle: 'normal' as const,
    color: textColor,
  },
  textStyle: {
    fontFamily,
    fontSize: 16,
    fontWeight: 400,
    fontStyle: 'normal' as const,
    color: textColor,
  },
  linkStyle: {
    titleStyle: {
      fontFamily,
      fontSize: 16,
      fontWeight: 600,
      fontStyle: 'normal' as const,
      color: textColor,
    },
    subtitleStyle: {
      fontFamily,
      fontSize: 14,
      fontWeight: 400,
      fontStyle: 'normal' as const,
      color: textColor,
    },
    backgroundColor: surfaceColor,
    backgroundOpacity: 1,
    borderWidth: 0,
    borderColor: 'transparent',
    shadow: false,
  },
});
const themeStyleDefaultsSchema = z.object({
  sectionBorderRadius: z.number().min(0).max(100),
  blockBorderRadius: z.number().min(0).max(100),
  headingStyle: typographyStyleSchema,
  textStyle: typographyStyleSchema,
  linkStyle: linkStyleSchema,
}).passthrough();
const defaultSectionDesign = {
  backgroundColor: null,
  textColor: null,
  backgroundMediaId: null,
  backgroundOverlay: 0,
  backgroundFit: 'cover' as const,
  backgroundPosition: '50% 50%',
  variant: 'custom' as const,
  paddingTop: 0,
  paddingBottom: 0,
  horizontalMargin: false,
  borderRadius: null,
  borderWidth: 0,
  borderColor: null,
  shadow: false,
  width: 'full' as const,
  mobileVisible: true,
  headingStyle: emptyTypographyOverride,
  textStyle: emptyTypographyOverride,
  linkStyle: {
    titleStyle: emptyTypographyOverride,
    subtitleStyle: emptyTypographyOverride,
    backgroundColor: null,
    backgroundOpacity: null,
    borderWidth: null,
    borderColor: null,
    shadow: null,
  },
};
const blockSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  content: z.record(z.string(), z.unknown()),
  design: z.object({
    backgroundColor: nullableString,
    textColor: nullableString,
    paddingTop: z.number().min(0).max(160).default(0),
    paddingBottom: z.number().min(0).max(160).default(0),
    borderRadius: z.number().min(0).max(100).nullable().default(null),
  }).passthrough(),
}).passthrough();
const sectionDesignSchema = z.object({
  backgroundColor: nullableString.default(null),
  textColor: nullableString.default(null),
  backgroundMediaId: nullableString.default(null),
  backgroundOverlay: z.number().min(0).max(1).default(0),
  backgroundFit: z.enum(['cover', 'contain']).default('cover'),
  backgroundPosition: z.string().default('50% 50%'),
  variant: z.enum(['off', 'custom', 'primary', 'secondary']).default('custom'),
  paddingTop: z.number().min(0).max(160).default(0),
  paddingBottom: z.number().min(0).max(160).default(0),
  horizontalMargin: z.boolean().default(false),
  borderRadius: z.number().min(0).max(100).nullable().default(null),
  borderWidth: z.number().min(0).max(16).default(0),
  borderColor: nullableString.default(null),
  shadow: z.boolean().default(false),
  width: z.enum(['full', 'contained']).default('full'),
  mobileVisible: z.boolean().default(true),
  headingStyle: typographyOverrideSchema.default(emptyTypographyOverride),
  textStyle: typographyOverrideSchema.default(emptyTypographyOverride),
  linkStyle: linkStyleOverrideSchema.default({
    titleStyle: emptyTypographyOverride,
    subtitleStyle: emptyTypographyOverride,
    backgroundColor: null,
    backgroundOpacity: null,
    borderWidth: null,
    borderColor: null,
    shadow: null,
  }),
}).passthrough();
const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  layout: z.enum([
    'single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third',
    'three-equal', 'stack', 'hero-overlay',
  ]),
  blocks: z.array(blockSchema),
  design: sectionDesignSchema.default(defaultSectionDesign),
}).passthrough();
const mediaSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  alt: z.string(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
}).passthrough();
const themeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colors: z.object({
    background: z.string().min(1),
    surface: z.string().min(1),
    text: z.string().min(1),
    primary: z.string().min(1),
  }).passthrough(),
  fontFamily: z.string().default('Inter, system-ui, sans-serif'),
  roundingStyle: z.enum(['rounded', 'pill', 'leaf', 'square']).default('rounded'),
  backgroundMediaId: nullableString.default(null),
  backgroundPreset: nullableString.default(null),
  backgroundFit: z.enum(['cover', 'contain']).default('cover'),
  backgroundPosition: z.string().min(1).default('50% 50%'),
  linkStylePreset: z.enum([
    'primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline',
    'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong',
  ]).default('primary-fill'),
  styleDefaults: themeStyleDefaultsSchema.optional(),
}).passthrough().transform((theme) => ({
  ...theme,
  styleDefaults: theme.styleDefaults ?? defaultThemeStyleDefaults(
    theme.fontFamily,
    theme.colors.text,
    theme.colors.surface,
  ),
}));

export const publicPageDocumentSchema = z.object({
  schemaVersion: z.literal(PUBLIC_PAGE_SCHEMA_VERSION),
  id: z.string().min(1).max(128),
  slug: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  profile: z.object({
    displayName: z.string(),
    description: z.string(),
    logoMediaId: nullableString,
    avatarMediaId: nullableString,
  }).passthrough(),
  theme: themeSchema,
  sections: z.array(sectionSchema),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    imageMediaId: nullableString,
  }).passthrough(),
  media: z.array(mediaSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).passthrough().superRefine((document, ctx) => {
  const ids = [document.id, ...document.sections.flatMap((section) => [
    section.id, ...section.blocks.map((block) => block.id),
  ]), ...document.media.map((media) => media.id)];
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: 'duplicate_id' });
  }
  const socialPlatforms = new Set<string>();
  document.sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      const path = ['sections', sectionIndex, 'blocks', blockIndex] as const;
      if (block.type === 'socials' || block.type === 'messengers') {
        ctx.addIssue({ code: 'custom', path: [...path, 'type'], message: 'unsupported_block_type' });
        return;
      }
      if (block.type !== 'social-button') return;
      const parsed = socialButtonContentSchema.safeParse(block.content);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => ctx.addIssue({
          code: 'custom',
          path: [...path, 'content', ...issue.path],
          message: issue.message,
        }));
        return;
      }
      if (socialPlatforms.has(parsed.data.platform)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'content', 'platform'],
          message: 'duplicate_social_platform',
        });
      }
      socialPlatforms.add(parsed.data.platform);
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
const isIanaTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

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

function hasValue(value: unknown): boolean {
  return typeof value === 'string' ? Boolean(value.trim()) : value !== null && value !== undefined;
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
  const content = block.content;
  const required = (...keys: string[]) => keys
    .filter((key) => !hasValue(content[key]))
    .map((key) => `${key} is required`);
  const items = (key: string, fields: string[]) => {
    const value = content[key];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return [];
      return fields.filter((field) => !hasValue((item as Record<string, unknown>)[field]))
        .map((field) => `${key}.${index}.${field} is required`);
    });
  };
  const safeItemUrls = (key: string, kind: 'contact' | 'web') => {
    const value = content[key];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) => item && typeof item === 'object'
      && !isSafeHref((item as Record<string, unknown>).url, kind)
      ? [`${key}.${index}.url is unsafe`] : []);
  };
  switch (block.type) {
    case 'hero': return required('title');
    case 'avatar': return [
      ...required('heading'),
      ...(!hasValue(content.imageMediaId) && !hasValue(content.imageUrl)
        ? ['imageMediaId or imageUrl is required'] : []),
    ];
    case 'button': return required('label', 'action');
    case 'links': return items('links', ['label', 'action']);
    case 'booking': return ['booking is unavailable'];
    case 'text': return required('body');
    case 'image': return [
      ...required('alt'),
      ...(!hasValue(content.imageMediaId) && !hasValue(content.url)
        ? ['imageMediaId is required'] : []),
    ];
    case 'gallery': {
      const value = content.images;
      if (!Array.isArray(value)) return [];
      return value.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        return [
          ...(!hasValue(record.mediaId) && !hasValue(record.url) ? [`images.${index}.mediaId is required`] : []),
          ...(!hasValue(record.alt) ? [`images.${index}.alt is required`] : []),
        ];
      });
    }
    case 'services': return items('services', ['title']);
    case 'contacts': return [...items('contacts', ['label', 'url']), ...safeItemUrls('contacts', 'contact')];
    case 'social-button': return [
      ...required('platform', 'label', 'url'),
      ...(typeof content.platform === 'string' && socialButtonPlatforms.has(content.platform)
        ? [] : ['platform is unsupported']),
      ...(isSafeHref(content.url, 'web') ? [] : ['url is unsafe']),
    ];
    case 'map': return [...required('address', 'url'), ...(isSafeHref(content.url, 'web') ? [] : ['url is unsafe'])];
    case 'divider': return [];
    case 'faq': return items('items', ['title', 'description']);
    default: return [];
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
    if (!KNOWN_PUBLIC_PAGE_BLOCKS.has(block.type)) {
      issues.push({ code: 'unknown_block', path: 'sections', blockId: block.id });
      continue;
    }
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
  visit(document.theme, 'theme');
  document.sections.forEach((section, index) => {
    visit(section.design, `sections.${index}.design`);
  });
  visible.forEach((block) => visit(block.content, `blocks.${block.id}.content`));
  return issues;
}
