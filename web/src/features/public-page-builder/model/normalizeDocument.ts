import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type BlockContent,
  type BlockDesign,
  type MediaReference,
  type PageBlock,
  type PageProfile,
  type PageSection,
  type SectionDesign,
  type PageSeo,
  type PageTheme,
  type PublicPageDocument,
  type PublicPageStatus,
  type SectionLayout,
  type TypographyStyle,
  type LinkStyle,
  type ResolvedTypographyStyle,
} from '../types/publicPage';
import { createStableId } from '../utils/createStableId';
import { DEFAULT_PUBLIC_PAGE_THEME } from '../config/themes';
import { SOCIAL_PLATFORMS, type SocialPlatform } from './socialPlatforms';

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

function fitValue(value: unknown): 'cover' | 'contain' {
  return value === 'contain' ? 'contain' : 'cover';
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
  const fontFamily = stringValue(theme.fontFamily, DEFAULT_PUBLIC_PAGE_THEME.fontFamily);
  const normalizedColors = {
    background: stringValue(colors.background, '#ffffff'), surface: stringValue(colors.surface, '#ffffff'),
    text: stringValue(colors.text, '#111827'), primary: stringValue(colors.primary, '#2563eb'),
  };
  const styles = isRecord(theme.styleDefaults) ? theme.styleDefaults : {};
  const fallback = DEFAULT_PUBLIC_PAGE_THEME.styleDefaults;

  return {
    id: stringValue(theme.id, 'minimal-light'),
    name: stringValue(theme.name, 'Minimal Light'),
    colors: normalizedColors,
    fontFamily,
    roundingStyle: theme.roundingStyle === 'pill' || theme.roundingStyle === 'leaf' || theme.roundingStyle === 'square' ? theme.roundingStyle : 'rounded',
    linkStylePreset: normalizeLinkStylePreset(theme.linkStylePreset, styles.linkStyle, normalizedColors),
    backgroundMediaId: nullableString(theme.backgroundMediaId),
    backgroundPreset: nullableString(theme.backgroundPreset),
    backgroundFit: fitValue(theme.backgroundFit),
    backgroundPosition: stringValue(theme.backgroundPosition, '50% 50%'),
    styleDefaults: {
      sectionBorderRadius: boundedNumber(styles.sectionBorderRadius, 0, 100),
      blockBorderRadius: boundedNumber(styles.blockBorderRadius, 24, 100),
      headingStyle: normalizeRequiredTypography(styles.headingStyle, { ...fallback.headingStyle, fontFamily, color: normalizedColors.text }),
      textStyle: normalizeRequiredTypography(styles.textStyle, { ...fallback.textStyle, fontFamily, color: normalizedColors.text }),
      linkStyle: normalizeRequiredLinkStyle(styles.linkStyle, fontFamily, normalizedColors, fallback.linkStyle),
    },
  };
}

function normalizeLinkStylePreset(value: unknown, styleValue: unknown, colors: PageTheme['colors']): PageTheme['linkStylePreset'] {
  const presets = new Set<PageTheme['linkStylePreset']>(['primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline', 'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong']);
  if (typeof value === 'string' && presets.has(value as PageTheme['linkStylePreset'])) {return value as PageTheme['linkStylePreset'];}
  const style = isRecord(styleValue) ? styleValue : {};
  const surface = style.backgroundColor === colors.surface;
  const outline = typeof style.borderWidth === 'number' && style.borderWidth > 0;
  const shadow = style.shadow === true;
  if (surface) {return outline ? 'surface-outline' : shadow ? 'surface-shadow' : 'surface-fill';}
  return outline ? 'primary-outline' : shadow ? 'primary-shadow' : 'primary-fill';
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
    backgroundMediaId: nullableString(design.backgroundMediaId),
    backgroundOverlay: typeof design.backgroundOverlay === 'number'
      ? Math.max(0, Math.min(1, design.backgroundOverlay)) : 0,
    backgroundFit: fitValue(design.backgroundFit),
    backgroundPosition: stringValue(design.backgroundPosition, '50% 50%'),
    paddingTop: boundedNumber(design.paddingTop, 0, 160),
    paddingBottom: boundedNumber(design.paddingBottom, 0, 160),
    borderRadius: nullableBoundedNumber(design.borderRadius, 100),
  };
}

function normalizeRequiredTypography(value: unknown, fallback: ResolvedTypographyStyle): ResolvedTypographyStyle {
  const style = isRecord(value) ? value : {};
  return { fontFamily: stringValue(style.fontFamily, fallback.fontFamily), fontSize: boundedNumber(style.fontSize, fallback.fontSize, 96, 8),
    fontWeight: boundedInteger(style.fontWeight, fallback.fontWeight, 100, 900),
    fontStyle: style.fontStyle === 'italic' ? 'italic' : style.fontStyle === 'normal' ? 'normal' : fallback.fontStyle,
    color: stringValue(style.color, fallback.color) };
}

function normalizeRequiredLinkStyle(value: unknown, fontFamily: string, colors: PageTheme['colors'], fallback: PageTheme['styleDefaults']['linkStyle']): PageTheme['styleDefaults']['linkStyle'] {
  const style = isRecord(value) ? value : {};
  return { titleStyle: normalizeRequiredTypography(style.titleStyle, { ...fallback.titleStyle, fontFamily, color: colors.primary }),
    subtitleStyle: normalizeRequiredTypography(style.subtitleStyle, { ...fallback.subtitleStyle, fontFamily, color: colors.text }),
    backgroundColor: stringValue(style.backgroundColor, colors.surface), backgroundOpacity: boundedNumber(style.backgroundOpacity, fallback.backgroundOpacity, 1),
    borderWidth: boundedNumber(style.borderWidth, fallback.borderWidth, 16), borderColor: stringValue(style.borderColor, colors.primary),
    shadow: typeof style.shadow === 'boolean' ? style.shadow : fallback.shadow };
}

function boundedNumber(value: unknown, fallback: number, maximum: number, minimum = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function nullableBoundedNumber(value: unknown, maximum: number, minimum = 0): number | null {
  return value === null || value === undefined ? null : boundedNumber(value, minimum, maximum, minimum);
}

function normalizeTypography(value: unknown): TypographyStyle {
  const style = isRecord(value) ? value : {};
  return { fontFamily: nullableString(style.fontFamily), fontSize: nullableBoundedNumber(style.fontSize, 96, 8),
    fontWeight: style.fontWeight === null || style.fontWeight === undefined ? null : boundedInteger(style.fontWeight, 400, 100, 900),
    fontStyle: style.fontStyle === 'normal' || style.fontStyle === 'italic' ? style.fontStyle : null, color: nullableString(style.color) };
}

function normalizeLinkStyle(value: unknown): LinkStyle {
  const style = isRecord(value) ? value : {};
  return { titleStyle: normalizeTypography(style.titleStyle), subtitleStyle: normalizeTypography(style.subtitleStyle),
    backgroundColor: nullableString(style.backgroundColor), backgroundOpacity: nullableBoundedNumber(style.backgroundOpacity, 1),
    borderWidth: nullableBoundedNumber(style.borderWidth, 16), borderColor: nullableString(style.borderColor),
    shadow: typeof style.shadow === 'boolean' ? style.shadow : null };
}

function normalizeSectionDesign(value: unknown): SectionDesign {
  const design = isRecord(value) ? value : {};
  return {
    variant: design.variant === 'off' || design.variant === 'primary' || design.variant === 'secondary' ? design.variant : 'custom',
    backgroundColor: nullableString(design.backgroundColor),
    textColor: nullableString(design.textColor),
    backgroundMediaId: nullableString(design.backgroundMediaId),
    backgroundOverlay: typeof design.backgroundOverlay === 'number' ? Math.max(0, Math.min(1, design.backgroundOverlay)) : 0,
    backgroundFit: fitValue(design.backgroundFit),
    backgroundPosition: stringValue(design.backgroundPosition, '50% 50%'),
    paddingTop: boundedNumber(design.paddingTop, 0, 160),
    paddingBottom: boundedNumber(design.paddingBottom, 0, 160),
    horizontalMargin: typeof design.horizontalMargin === 'boolean' ? design.horizontalMargin : false,
    borderRadius: nullableBoundedNumber(design.borderRadius, 100),
    borderWidth: boundedNumber(design.borderWidth, 0, 16),
    borderColor: nullableString(design.borderColor),
    shadow: typeof design.shadow === 'boolean' ? design.shadow : false,
    width: design.width === 'contained' ? 'contained' : 'full',
    mobileVisible: typeof design.mobileVisible === 'boolean' ? design.mobileVisible : true,
    headingStyle: normalizeTypography(design.headingStyle), textStyle: normalizeTypography(design.textStyle),
    linkStyle: normalizeLinkStyle(design.linkStyle),
  };
}

function normalizeBlock(value: unknown): PageBlock | null {
  if (!isRecord(value) || typeof value.type !== 'string' || value.type.length === 0) {
    return null;
  }

  if (value.type === 'socials' || value.type === 'messengers') {return null;}
  if (value.type === 'social-button') {
    const content = isRecord(value.content) ? value.content : {};
    if (typeof content.platform !== 'string' || !SOCIAL_PLATFORMS.includes(content.platform as SocialPlatform)) {return null;}
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
    design: normalizeSectionDesign(value.design),
    blocks,
  };
}

export function createEmptyPageSection(variant: SectionDesign['variant'] = 'off'): PageSection {
  return normalizeSection({ design: { variant } })!;
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
  const normalizedSections = Array.isArray(document.sections)
    ? document.sections.map(normalizeSection).filter((section): section is PageSection => section !== null)
    : [];
  const seenSocialPlatforms = new Set<SocialPlatform>();
  const sections = normalizedSections.map((section) => ({
    ...section,
    blocks: section.blocks.filter((block) => {
      if (block.type !== 'social-button') {return true;}
      const platform = block.content.platform as SocialPlatform;
      if (seenSocialPlatforms.has(platform)) {return false;}
      seenSocialPlatforms.add(platform);
      return true;
    }),
  }));
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
