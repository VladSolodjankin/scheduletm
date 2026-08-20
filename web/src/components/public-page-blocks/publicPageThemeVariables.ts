import type { CSSProperties } from 'react';
import type {
  PageSection,
  PageTheme,
  ResolvedTypographyStyle,
  ThemeTypographyToken,
  TypographyStyle,
} from '../../features/public-page-builder/types/publicPage';
import { readableTextColor } from '../../features/public-page-builder/config/themes';

export type PublicPageThemeVariables = CSSProperties & Record<`--${string}`, string | number>;

type PublicPageThemeVariableOptions = {
  avatarSize?: number;
  coverColor?: string | null;
  leadingSectionRadius?: string;
};

function tokenStyle(token: ThemeTypographyToken, color: string): ResolvedTypographyStyle {
  return { fontFamily: token.fontFamily, fontSize: token.fontSize, fontWeight: token.fontWeight, fontStyle: 'normal', color };
}

function resolveTypography(fallback: ResolvedTypographyStyle, override?: TypographyStyle): ResolvedTypographyStyle {
  if (!override) {return fallback;}
  return {
    fontFamily: override.fontFamily ?? fallback.fontFamily,
    fontSize: override.fontSize ?? fallback.fontSize,
    fontWeight: override.fontWeight ?? fallback.fontWeight,
    fontStyle: override.fontStyle ?? fallback.fontStyle,
    color: override.color ?? fallback.color,
  };
}

function resolveSectionBackground(theme: PageTheme, section?: PageSection): string {
  if (!section) {return theme.colors.primary;}
  if (section.design.backgroundColor) {return section.design.backgroundColor;}
  if (section.design.variant === 'primary') {return theme.colors.primary;}
  if (section.design.variant === 'secondary') {return theme.colors.surface;}
  return 'transparent';
}

function effectiveSectionBackground(theme: PageTheme, section?: PageSection): string {
  if (!section) {return theme.colors.background;}
  const background = resolveSectionBackground(theme, section);
  return background === 'transparent' ? theme.colors.background : background;
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalized = color.trim().replace(/^#([\da-f])([\da-f])([\da-f])$/i, '#$1$1$2$2$3$3');
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(normalized);
  return match ? match.slice(1).map((value) => Number.parseInt(value, 16)) as [number, number, number] : null;
}

function effectiveOpaqueColor(foreground: string, background: string, opacity: number): string {
  if (opacity >= 1) {return foreground;}
  if (opacity <= 0) {return background;}
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb) {return foreground;}
  const channels = foregroundRgb.map((channel, index) => (
    Math.round(channel * opacity + backgroundRgb[index] * (1 - opacity))
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function linkRadius(theme: PageTheme): string {
  if (theme.roundingStyle === 'pill') {return '40px';}
  if (theme.roundingStyle === 'leaf') {return `${theme.tokens.layout.linkRadius}px 4px ${theme.tokens.layout.linkRadius}px 4px`;}
  if (theme.roundingStyle === 'square') {return '2px';}
  return `${theme.tokens.layout.linkRadius}px`;
}

function textVariables(prefix: string, token: ThemeTypographyToken): PublicPageThemeVariables {
  return {
    [`--${prefix}-font-family`]: token.fontFamily,
    [`--${prefix}-fontsize`]: `${token.fontSize}px`,
    [`--${prefix}-font-weight`]: token.fontWeight,
    [`--${prefix}-lineheight`]: token.lineHeight,
    [`--${prefix}-letterspacing`]: `${token.letterSpacing}px`,
  };
}

export function resolvePublicPageThemeVariables(
  theme: PageTheme,
  section?: PageSection,
  options: PublicPageThemeVariableOptions = {},
): PublicPageThemeVariables {
  const sectionOverrides = section && section.design.variant !== 'off' ? section.design : undefined;
  const sectionBackground = effectiveSectionBackground(theme, section);
  const sectionForeground = sectionOverrides?.textColor?.trim() || readableTextColor(sectionBackground);
  const headingForeground = sectionOverrides?.headingStyle?.color?.trim() || sectionForeground;
  const textForeground = sectionOverrides?.textStyle?.color?.trim() || sectionForeground;
  const title = resolveTypography(
    tokenStyle(theme.tokens.typography.avatarTitle, headingForeground),
    sectionOverrides?.headingStyle,
  );
  const bio = resolveTypography(
    tokenStyle(theme.tokens.typography.avatarBio, textForeground),
    sectionOverrides?.textStyle,
  );
  const linkDefault = theme.styleDefaults.linkStyle;
  const link = sectionOverrides?.linkStyle;
  const useContrastingSectionLink = Boolean(sectionOverrides) && readableTextColor(sectionBackground) === '#ffffff';
  const linkBackground = link?.backgroundColor?.trim()
    || (useContrastingSectionLink ? theme.colors.background : linkDefault.backgroundColor);
  const linkOpacity = link?.backgroundOpacity ?? linkDefault.backgroundOpacity;
  const linkForeground = readableTextColor(effectiveOpaqueColor(linkBackground, sectionBackground, linkOpacity));
  const linkTitle = resolveTypography({ ...linkDefault.titleStyle, color: linkForeground }, link?.titleStyle);
  const linkSubtitle = resolveTypography({ ...linkDefault.subtitleStyle, color: linkForeground }, link?.subtitleStyle);
  const linkBorderColor = link?.borderColor?.trim()
    || (useContrastingSectionLink ? linkBackground : linkDefault.borderColor);
  const linkShadow = link?.shadow ?? linkDefault.shadow;
  const linkShadowParams = linkShadow
    ? theme.linkStylePreset.endsWith('strong')
      ? `0 4px 0 ${theme.tokens.colors.linkShadow}`
      : `0 7px 14px ${theme.tokens.colors.linkShadow}`
    : 'none';

  return {
    '--page-background': theme.colors.background,
    '--page-text': theme.colors.text,
    '--page-section-background': resolveSectionBackground(theme, section),
    '--page-section-text': sectionForeground,
    '--theme-heading-color': headingForeground,
    '--theme-text-color': textForeground,
    '--avatar-cover-background': options.coverColor?.trim() || theme.colors.primary,
    '--avatar-surface-background': theme.colors.surface,
    '--avatar-title-font-family': title.fontFamily,
    '--avatar-title-size': `${title.fontSize}px`,
    '--avatar-title-weight': title.fontWeight,
    '--avatar-title-style': title.fontStyle,
    '--avatar-title-color': title.color,
    '--avatar-title-line-height': theme.tokens.typography.avatarTitle.lineHeight,
    '--avatar-bio-font-family': bio.fontFamily,
    '--avatar-bio-size': `${bio.fontSize}px`,
    '--avatar-bio-weight': bio.fontWeight,
    '--avatar-bio-style': bio.fontStyle,
    '--avatar-bio-color': bio.color,
    '--avatar-bio-line-height': theme.tokens.typography.avatarBio.lineHeight,
    '--avatar-size': `${options.avatarSize ?? 150}px`,
    '--avatar-leading-section-radius': options.leadingSectionRadius ?? '0px',
    '--block-border-radius': `${theme.tokens.layout.blockRadius}px`,
    '--theme-link-offset': `${theme.tokens.layout.linkGap}px`,
    '--theme-link-border-radius': linkRadius(theme),
    '--theme-link-background': linkBackground,
    '--theme-link-background-opacity': `${linkOpacity * 100}%`,
    '--theme-link-title-transform': 'none',
    '--theme-link-title-font-family': linkTitle.fontFamily,
    '--theme-link-title-fontsize': `${linkTitle.fontSize}px`,
    '--theme-link-title-lineheight': theme.tokens.typography.linkTitle.lineHeight,
    '--theme-link-title-letterspacing': `${theme.tokens.typography.linkTitle.letterSpacing}px`,
    '--theme-link-title-font-weight': linkTitle.fontWeight,
    '--theme-link-title-font-style': linkTitle.fontStyle,
    '--theme-link-title-color': linkTitle.color,
    '--theme-link-subtitle-font-family': linkSubtitle.fontFamily,
    '--theme-link-subtitle-fontsize': `${linkSubtitle.fontSize}px`,
    '--theme-link-subtitle-lineheight': theme.tokens.typography.linkSubtitle.lineHeight,
    '--theme-link-subtitle-letterspacing': `${theme.tokens.typography.linkSubtitle.letterSpacing}px`,
    '--theme-link-subtitle-font-weight': linkSubtitle.fontWeight,
    '--theme-link-subtitle-font-style': linkSubtitle.fontStyle,
    '--theme-link-subtitle-color': linkSubtitle.color,
    '--theme-link-border-width': `${link?.borderWidth ?? linkDefault.borderWidth}px`,
    '--theme-link-border-color': linkBorderColor,
    '--theme-link-shadow-params': linkShadowParams,
    '--theme-font-weight-bold': theme.tokens.typography.boldFontWeight,
    ...textVariables('theme-h1', theme.tokens.typography.h1),
    ...textVariables('theme-h2', theme.tokens.typography.h2),
    ...textVariables('theme-h3', theme.tokens.typography.h3),
    ...textVariables('theme-text-lg', theme.tokens.typography.textLarge),
    ...textVariables('theme-text-md', theme.tokens.typography.textMedium),
    ...textVariables('theme-text-sm', theme.tokens.typography.textSmall),
  };
}
