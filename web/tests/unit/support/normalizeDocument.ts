/* Test fixture: fills a partial document with defaults. Production code never accepts partial documents. */
import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type BlockContent,
  type BlockDesign,
  type MediaReference,
  type PageBlock,
  type PageSection,
  type SectionDesign,
  type PageSeo,
  type PageTheme,
  type PublicPageDocument,
  type PublicPageStatus,
  type ItemSize,
  type LinkAlign,
  type LinkWidth,
  type PageWidth,
  type TypographyStyle,
  type LinkStyle,
  type ResolvedTypographyStyle,
  type PageThemeTokens,
  type ThemeSwatches,
  type ThemeTypographyToken,
} from '../../../src/features/public-page-builder/types/publicPage';
import { normalizeRichTextDocument } from '../../../src/features/public-page-builder/model/normalizeRichText';
import { createStableId } from '../../../src/features/public-page-builder/utils/createStableId';
import {
  applyPublicPageThemeColors,
  applyPublicPageThemeFont,
  DEFAULT_PUBLIC_PAGE_THEME,
  findPublicPageTheme,
} from '../../../src/features/public-page-builder/config/themes';
import { normalizeServicesContent } from '../../../src/features/public-page-builder/model/services';
import { normalizeCredentialsContent } from '../../../src/features/public-page-builder/model/credentials';
import { normalizeReviewsContent } from '../../../src/features/public-page-builder/model/reviews';
import { isCtaAction } from '../../../src/features/public-page-builder/model/cta';

const statuses = new Set<PublicPageStatus>(['draft', 'published', 'archived']);
const itemSizes = new Set<ItemSize>(['full', 'half']);
const pageWidths = new Set<PageWidth>(['narrow', 'medium', 'wide']);
const linkWidths = new Set<LinkWidth>(['full', 'auto']);
const linkAligns = new Set<LinkAlign>(['left', 'center', 'right']);
const imageMimeTypes = new Set<MediaReference['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const avatarLayouts = new Set(['centered', 'cover-centered', 'cover-left', 'image-cover']);
const avatarSizes = [65, 95, 125, 150] as const;

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

function normalizeTheme(value: unknown): PageTheme {
  const theme = isRecord(value) ? value : {};
  const themeId = stringValue(theme.id, DEFAULT_PUBLIC_PAGE_THEME.id);
  const palette = findPublicPageTheme(themeId);
  const colors = isRecord(theme.colors) ? theme.colors : {};
  const baseColors = palette?.colors ?? DEFAULT_PUBLIC_PAGE_THEME.colors;
  const normalizedColors = {
    background: stringValue(colors.background, baseColors.background),
    surface: stringValue(colors.surface, baseColors.surface),
    text: stringValue(colors.text, baseColors.text),
    primary: stringValue(colors.primary, baseColors.primary),
  };
  const fontFamily = stringValue(theme.fontFamily, palette?.fontFamily ?? DEFAULT_PUBLIC_PAGE_THEME.fontFamily);
  const themeBase = applyPublicPageThemeFont(
    palette ?? applyPublicPageThemeColors(DEFAULT_PUBLIC_PAGE_THEME, normalizedColors),
    fontFamily,
  );
  const tokens = normalizeThemeTokens(theme.tokens, themeBase.tokens);
  const styles = isRecord(theme.styleDefaults) ? theme.styleDefaults : {};
  const fallback = themeBase.styleDefaults;

  return {
    id: themeId,
    name: stringValue(theme.name, palette?.name ?? 'Custom'),
    swatches: normalizeSwatches(theme.swatches, palette?.swatches ?? [normalizedColors.background, normalizedColors.primary, normalizedColors.surface, normalizedColors.text]),
    colors: normalizedColors,
    tokens,
    fontFamily,
    pageWidth: pageWidths.has(theme.pageWidth as PageWidth) ? theme.pageWidth as PageWidth : 'narrow',
    roundingStyle: theme.roundingStyle === 'pill' || theme.roundingStyle === 'leaf' || theme.roundingStyle === 'square' ? theme.roundingStyle : 'rounded',
    linkStylePreset: normalizeLinkStylePreset(theme.linkStylePreset, styles.linkStyle, normalizedColors),
    linkTextAlign: theme.linkTextAlign === 'left' ? 'left' : 'center',
    backgroundMediaId: nullableString(theme.backgroundMediaId),
    backgroundPreset: nullableString(theme.backgroundPreset),
    backgroundFit: fitValue(theme.backgroundFit),
    backgroundPosition: stringValue(theme.backgroundPosition, '50% 50%'),
    styleDefaults: {
      sectionBorderRadius: boundedNumber(styles.sectionBorderRadius, tokens.layout.blockRadius, 100),
      blockBorderRadius: boundedNumber(styles.blockBorderRadius, tokens.layout.blockRadius, 100),
      ...(styles.socialButtonColors === 'theme' ? { socialButtonColors: 'theme' as const } : {}),
      headingStyle: normalizeRequiredTypography(styles.headingStyle, { ...fallback.headingStyle, fontFamily, color: normalizedColors.text }),
      textStyle: normalizeRequiredTypography(styles.textStyle, { ...fallback.textStyle, fontFamily, color: normalizedColors.text }),
      linkStyle: normalizeRequiredLinkStyle(styles.linkStyle, fontFamily, normalizedColors, fallback.linkStyle),
    },
  };
}

function normalizeSwatches(value: unknown, fallback: ThemeSwatches): ThemeSwatches {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => typeof item !== 'string' || !item)) {
    return fallback;
  }
  return [value[0], value[1], value[2], value[3]] as ThemeSwatches;
}

function normalizeThemeTypographyToken(value: unknown, fallback: ThemeTypographyToken): ThemeTypographyToken {
  const token = isRecord(value) ? value : {};
  return {
    fontFamily: stringValue(token.fontFamily, fallback.fontFamily),
    fontSize: boundedNumber(token.fontSize, fallback.fontSize, 96, 8),
    fontWeight: boundedInteger(token.fontWeight, fallback.fontWeight, 100, 900),
    lineHeight: boundedNumber(token.lineHeight, fallback.lineHeight, 3, 0.5),
    letterSpacing: boundedNumber(token.letterSpacing, fallback.letterSpacing, 20, -10),
  };
}

function normalizeThemeTokens(value: unknown, fallback: PageThemeTokens): PageThemeTokens {
  const tokens = isRecord(value) ? value : {};
  const colors = isRecord(tokens.colors) ? tokens.colors : {};
  const typography = isRecord(tokens.typography) ? tokens.typography : {};
  const layout = isRecord(tokens.layout) ? tokens.layout : {};
  const color = (key: keyof PageThemeTokens['colors']) => stringValue(colors[key], fallback.colors[key]);
  return {
    colors: {
      contrast: color('contrast'),
      linkTitle: color('linkTitle'),
      linkSubtitle: color('linkSubtitle'),
      linkShadow: color('linkShadow'),
      linkBorder: color('linkBorder'),
      focus: color('focus'),
      checkboxBackground: color('checkboxBackground'),
    },
    typography: {
      fontFamily: stringValue(typography.fontFamily, fallback.typography.fontFamily),
      fontWeight: boundedInteger(typography.fontWeight, fallback.typography.fontWeight, 100, 900),
      boldFontWeight: boundedInteger(typography.boldFontWeight, fallback.typography.boldFontWeight, 100, 900),
      headingColor: stringValue(typography.headingColor, fallback.typography.headingColor),
      avatarTitle: normalizeThemeTypographyToken(typography.avatarTitle, fallback.typography.avatarTitle),
      avatarBio: normalizeThemeTypographyToken(typography.avatarBio, fallback.typography.avatarBio),
      linkTitle: normalizeThemeTypographyToken(typography.linkTitle, fallback.typography.linkTitle),
      linkSubtitle: normalizeThemeTypographyToken(typography.linkSubtitle, fallback.typography.linkSubtitle),
      h1: normalizeThemeTypographyToken(typography.h1, fallback.typography.h1),
      h2: normalizeThemeTypographyToken(typography.h2, fallback.typography.h2),
      h3: normalizeThemeTypographyToken(typography.h3, fallback.typography.h3),
      textLarge: normalizeThemeTypographyToken(typography.textLarge, fallback.typography.textLarge),
      textMedium: normalizeThemeTypographyToken(typography.textMedium, fallback.typography.textMedium),
      textSmall: normalizeThemeTypographyToken(typography.textSmall, fallback.typography.textSmall),
    },
    layout: {
      blockRadius: boundedNumber(layout.blockRadius, fallback.layout.blockRadius, 100),
      linkRadius: boundedNumber(layout.linkRadius, fallback.layout.linkRadius, 100),
      linkGap: boundedNumber(layout.linkGap, fallback.layout.linkGap, 100),
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
    linkStyle: isRecord(design.linkStyle) ? normalizeLinkStyle(design.linkStyle) : null,
    animation: design.animation === 'pulse' || design.animation === 'lift' ? design.animation : 'none',
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
    shadow: typeof style.shadow === 'boolean' ? style.shadow : fallback.shadow,
    width: linkWidths.has(style.width as LinkWidth) ? style.width as LinkWidth : fallback.width,
    align: linkAligns.has(style.align as LinkAlign) ? style.align as LinkAlign : fallback.align };
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
    shadow: typeof style.shadow === 'boolean' ? style.shadow : null,
    width: linkWidths.has(style.width as LinkWidth) ? style.width as LinkWidth : null,
    align: linkAligns.has(style.align as LinkAlign) ? style.align as LinkAlign : null };
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

  const rawContent = isRecord(value.content) ? value.content : {};
  return {
    id: stableId(value.id),
    type: value.type,
    name: stringValue(value.name),
    visible: typeof value.visible === 'boolean' ? value.visible : true,
    size: normalizeItemSize(value.size),
    content: value.type === 'text' ? normalizeTextContent(rawContent)
      : value.type === 'avatar' ? normalizeAvatarContent(rawContent)
        : value.type === 'services' ? normalizeServicesContent(rawContent)
          : value.type === 'credentials' ? normalizeCredentialsContent(rawContent)
            : value.type === 'reviews' ? normalizeReviewsContent(rawContent)
          : value.type === 'contacts' ? normalizeContactsContent(rawContent)
          : rawContent as BlockContent,
    design: normalizeDesign(value.design),
    schedule: isRecord(value.schedule) ? { period: isRecord(value.schedule.period) ? { startAt: stringValue(value.schedule.period.startAt), endAt: stringValue(value.schedule.period.endAt) } : null, weekdays: Array.isArray(value.schedule.weekdays) ? value.schedule.weekdays as number[] : null } : { period: null, weekdays: null },
  };
}

function normalizeItemSize(value: unknown): ItemSize {
  return itemSizes.has(value as ItemSize) ? value as ItemSize : 'full';
}

function normalizeSection(value: unknown): PageSection | null {
  if (!isRecord(value)) {
    return null;
  }

  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(normalizeBlock).filter((block): block is PageBlock => block !== null)
    : [];

  return {
    id: stableId(value.id),
    name: stringValue(value.name),
    visible: typeof value.visible === 'boolean' ? value.visible : true,
    size: normalizeItemSize(value.size),
    design: normalizeSectionDesign(value.design),
    blocks,
  };
}

function normalizeTextContent(content: Record<string, unknown>): BlockContent {
  return { document: normalizeRichTextDocument(content.document) };
}

function normalizeAvatarContent(content: Record<string, unknown>): BlockContent {
  const layout = avatarLayouts.has(content.layout as string) ? content.layout as string : 'centered';
  const avatarSize = avatarSizes.includes(content.avatarSize as typeof avatarSizes[number]) ? content.avatarSize : 150;
  return {
    heading: stringValue(content.heading),
    subtitle: stringValue(content.subtitle),
    imageMediaId: nullableString(content.imageMediaId),
    imageAlt: stringValue(content.imageAlt),
    layout,
    avatarSize,
    coverColor: nullableString(content.coverColor),
    coverMediaId: nullableString(content.coverMediaId),
  };
}

function normalizeContactsContent(content: Record<string, unknown>): BlockContent {
  const contacts = Array.isArray(content.contacts) ? content.contacts.flatMap((item) => {
    if (!isRecord(item) || !isCtaAction(item.action)) {return [];}
    return [{ id: stableId(item.id), label: stringValue(item.label), action: structuredClone(item.action) }];
  }) : [];
  return { title: stringValue(content.title), contacts };
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
    locale: document.locale === 'ru' ? 'ru' : 'en',
    timezone: stringValue(document.timezone, 'UTC'),
    archivedBlocks: Array.isArray(document.archivedBlocks) ? document.archivedBlocks.flatMap((entry) => {
      if (!isRecord(entry)) {return [];}
      const block = normalizeBlock(entry.block);
      return block ? [{ block, sourceSectionId: stringValue(entry.sourceSectionId) }] : [];
    }) : [],
    theme: normalizeTheme(document.theme),
    sections,
    seo: normalizeSeo(document.seo),
    media,
    createdAt: stringValue(document.createdAt, now),
    updatedAt: stringValue(document.updatedAt, now),
  };
}
