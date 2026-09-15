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

function blendedBackground(foreground: string, background: string, opacity: number): string {
  if (opacity >= 1) {return foreground;}
  if (opacity <= 0) {return background;}
  const parse = (color: string) => {
    const normalized = color.trim().replace(/^#([\da-f])([\da-f])([\da-f])$/i, '#$1$1$2$2$3$3');
    return /^#[\da-f]{6}$/i.test(normalized) ? [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) : null;
  };
  const first = parse(foreground); const second = parse(background);
  return first && second ? `#${first.map((channel, index) => Math.round(channel * opacity + second[index] * (1 - opacity)).toString(16).padStart(2, '0')).join('')}` : foreground;
}

function sameColor(first: string, second: string): boolean {
  const normalize = (color: string) => color.trim().toLowerCase().replace(/^#([\da-f])([\da-f])([\da-f])$/, '#$1$1$2$2$3$3');
  return normalize(first) === normalize(second);
}


function linkRadius(theme: PageTheme): string {
  if (theme.roundingStyle === 'leaf') {return `${theme.tokens.layout.linkRadius}px 4px ${theme.tokens.layout.linkRadius}px 4px`;}
  return `${theme.tokens.layout.linkRadius}px`;
}

function textVariables(prefix: string, token: ThemeTypographyToken, override?: TypographyStyle): PublicPageThemeVariables {
  return {
    [`--${prefix}-font-family`]: override?.fontFamily ?? token.fontFamily,
    [`--${prefix}-fontsize`]: `${(override?.fontSize ?? token.fontSize) / 16}rem`,
    [`--${prefix}-font-weight`]: override?.fontWeight ?? token.fontWeight,
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
  const rawSectionBackground = sectionOverrides ? resolveSectionBackground(theme, section) : theme.colors.background;
  const sectionBackground = rawSectionBackground === 'transparent' ? theme.colors.background : rawSectionBackground;
  const sectionForeground = sectionOverrides?.textColor?.trim() || readableTextColor(sectionBackground);
  const inheritedText = (color: string) => sectionOverrides && sameColor(color, theme.colors.text) ? sectionForeground : color;
  const headingForeground = sectionOverrides?.headingStyle?.color?.trim() || sectionOverrides?.textColor?.trim() || inheritedText(theme.styleDefaults.headingStyle.color);
  const textForeground = sectionOverrides?.textStyle?.color?.trim() || sectionOverrides?.textColor?.trim() || inheritedText(theme.styleDefaults.textStyle.color);
  const title = resolveTypography(
    { ...tokenStyle(theme.tokens.typography.avatarTitle, headingForeground), fontStyle: theme.styleDefaults.headingStyle.fontStyle },
    sectionOverrides?.headingStyle,
  );
  const bio = resolveTypography(
    { ...tokenStyle(theme.tokens.typography.avatarBio, textForeground), fontStyle: theme.styleDefaults.textStyle.fontStyle },
    sectionOverrides?.textStyle,
  );
  const linkDefault = theme.styleDefaults.linkStyle;
  const link = sectionOverrides?.linkStyle;
  const roleBackground = theme.linkStylePreset.startsWith('surface-') ? theme.colors.surface : theme.colors.primary;
  const contrastingSection = Boolean(sectionOverrides) && readableTextColor(sectionBackground) === '#ffffff';
  const linkBackground = link?.backgroundColor?.trim() || (contrastingSection && sameColor(linkDefault.backgroundColor, roleBackground) ? theme.colors.background : linkDefault.backgroundColor);
  const linkOpacity = link?.backgroundOpacity ?? linkDefault.backgroundOpacity;
  const roleForeground = theme.linkStylePreset.startsWith('surface-') ? theme.colors.text : theme.tokens.colors.contrast;
  const adaptiveForeground = readableTextColor(blendedBackground(linkBackground, sectionBackground, linkOpacity));
  const inheritLinkColor = (color: string) => sameColor(color, roleForeground) ? adaptiveForeground : color;
  const linkTitle = resolveTypography({ ...linkDefault.titleStyle, color: inheritLinkColor(linkDefault.titleStyle.color) }, link?.titleStyle);
  const linkSubtitle = resolveTypography({ ...linkDefault.subtitleStyle, color: inheritLinkColor(linkDefault.subtitleStyle.color) }, link?.subtitleStyle);
  const linkBorderColor = link?.borderColor?.trim() || (contrastingSection && sameColor(linkDefault.borderColor, theme.colors.primary) ? linkBackground : linkDefault.borderColor);
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
    '--theme-heading-font-style': sectionOverrides?.headingStyle.fontStyle ?? theme.styleDefaults.headingStyle.fontStyle,
    '--theme-text-font-style': sectionOverrides?.textStyle.fontStyle ?? theme.styleDefaults.textStyle.fontStyle,
    '--avatar-cover-background': options.coverColor?.trim() || theme.colors.primary,
    '--avatar-surface-background': theme.colors.surface,
    '--avatar-title-font-family': title.fontFamily,
    '--avatar-title-size': `${title.fontSize / 16}rem`,
    '--avatar-title-weight': title.fontWeight,
    '--avatar-title-style': title.fontStyle,
    '--avatar-title-color': title.color,
    '--avatar-title-line-height': theme.tokens.typography.avatarTitle.lineHeight,
    '--avatar-bio-font-family': bio.fontFamily,
    '--avatar-bio-size': `${bio.fontSize / 16}rem`,
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
    '--theme-link-title-fontsize': `${linkTitle.fontSize / 16}rem`,
    '--theme-link-title-lineheight': theme.tokens.typography.linkTitle.lineHeight,
    '--theme-link-title-letterspacing': `${theme.tokens.typography.linkTitle.letterSpacing}px`,
    '--theme-link-title-font-weight': linkTitle.fontWeight,
    '--theme-link-title-font-style': linkTitle.fontStyle,
    '--theme-link-title-color': linkTitle.color,
    '--theme-link-subtitle-font-family': linkSubtitle.fontFamily,
    '--theme-link-subtitle-fontsize': `${linkSubtitle.fontSize / 16}rem`,
    '--theme-link-subtitle-lineheight': theme.tokens.typography.linkSubtitle.lineHeight,
    '--theme-link-subtitle-letterspacing': `${theme.tokens.typography.linkSubtitle.letterSpacing}px`,
    '--theme-link-subtitle-font-weight': linkSubtitle.fontWeight,
    '--theme-link-subtitle-font-style': linkSubtitle.fontStyle,
    '--theme-link-subtitle-color': linkSubtitle.color,
    '--theme-link-border-width': `${link?.borderWidth ?? linkDefault.borderWidth}px`,
    '--theme-link-border-color': linkBorderColor,
    '--theme-link-shadow-params': linkShadowParams,
    '--theme-font-weight-bold': theme.tokens.typography.boldFontWeight,
    ...textVariables('theme-h1', theme.tokens.typography.h1, sectionOverrides?.headingStyle),
    ...textVariables('theme-h2', theme.tokens.typography.h2, sectionOverrides?.headingStyle),
    ...textVariables('theme-h3', theme.tokens.typography.h3, sectionOverrides?.headingStyle),
    ...textVariables('theme-text-lg', theme.tokens.typography.textLarge, sectionOverrides?.textStyle),
    ...textVariables('theme-text-md', theme.tokens.typography.textMedium, sectionOverrides?.textStyle),
    ...textVariables('theme-text-sm', theme.tokens.typography.textSmall, sectionOverrides?.textStyle),
  };
}
