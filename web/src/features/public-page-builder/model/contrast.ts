import { resolvePublicPageThemeVariables } from '../../../components/public-page-blocks/publicPageThemeVariables';
import type { PageBlock, PageSection, PageTheme } from '../types/publicPage';

export type ContrastStatus = 'pass' | 'fail' | 'unknown';
export type ContrastUnknownReason = 'background-image' | 'background-preset' | 'unsupported-color' | 'unknown-surface' | 'nested-surface';

export type ContrastCheck = {
  id: string;
  ratio: number | null;
  minimum: number;
  status: ContrastStatus;
  reason?: ContrastUnknownReason;
};

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];
type KnownSurface = { color: Rgba; reason?: never };
type UnknownSurface = { color: null; reason: ContrastUnknownReason };
type Surface = KnownSurface | UnknownSurface;

const BLACK: Rgba = [0, 0, 0, 1];
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

function parseBoundedNumber(value: string, minimum: number, maximum: number): number | null {
  if (!NUMBER.test(value)) {return null;}
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function parseChannel(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    const percentage = parseBoundedNumber(trimmed.slice(0, -1), 0, 100);
    return percentage === null ? null : percentage * 2.55;
  }
  return parseBoundedNumber(trimmed, 0, 255);
}

function parseAlpha(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    const percentage = parseBoundedNumber(trimmed.slice(0, -1), 0, 100);
    return percentage === null ? null : percentage / 100;
  }
  return parseBoundedNumber(trimmed, 0, 1);
}

function parseHex(value: string): Rgba | null {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[\da-f]+$/i.test(hex)) {return null;}
  const expanded = hex.length <= 4 ? [...hex].map((character) => `${character}${character}`).join('') : hex;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return [red, green, blue, alpha];
}

function parseRgb(value: string): Rgba | null {
  const match = /^rgba?\((.*)\)$/i.exec(value);
  if (!match) {return null;}
  const content = match[1].trim();
  let channels: string[];
  let alphaText: string | undefined;
  if (content.includes(',')) {
    const parts = content.split(',').map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) {return null;}
    channels = parts.slice(0, 3);
    alphaText = parts[3];
  } else {
    const slashParts = content.split('/').map((part) => part.trim());
    if (slashParts.length > 2) {return null;}
    channels = slashParts[0].split(/\s+/).filter(Boolean);
    alphaText = slashParts[1];
    if (channels.length === 4 && alphaText === undefined) {alphaText = channels.pop();}
    if (channels.length !== 3) {return null;}
  }
  const parsedChannels = channels.map(parseChannel);
  if (parsedChannels.some((channel) => channel === null)) {return null;}
  const alpha = alphaText === undefined ? 1 : parseAlpha(alphaText);
  if (alpha === null) {return null;}
  return [parsedChannels[0]!, parsedChannels[1]!, parsedChannels[2]!, alpha];
}

function parseColor(value: unknown): Rgba | null {
  if (typeof value !== 'string') {return null;}
  const normalized = value.trim().toLowerCase();
  if (normalized === 'black') {return BLACK;}
  if (normalized === 'white') {return [255, 255, 255, 1];}
  if (normalized === 'transparent') {return [0, 0, 0, 0];}
  if (normalized.startsWith('#')) {return parseHex(normalized);}
  return parseRgb(normalized);
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  if (alpha <= 0) {return [0, 0, 0, 0];}
  return [
    (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
    alpha,
  ];
}

function opaqueSurface(value: unknown, parent: Surface | null, opacity = 1): Surface {
  const parsed = parseColor(value);
  if (!parsed) {return { color: null, reason: 'unsupported-color' };}
  const foreground: Rgba = [parsed[0], parsed[1], parsed[2], parsed[3] * Math.max(0, Math.min(1, opacity))];
  if (foreground[3] >= 1) {return { color: [foreground[0], foreground[1], foreground[2], 1] };}
  if (!parent?.color) {return { color: null, reason: parent?.reason ?? 'unknown-surface' };}
  return { color: composite(foreground, parent.color) };
}

function linearChannel(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgba): number {
  return 0.2126 * linearChannel(color[0]) + 0.7152 * linearChannel(color[1]) + 0.0722 * linearChannel(color[2]);
}

function ratioForOpaqueColors(first: Rgba, second: Rgba): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastRatio(foreground: string, background: string): number | null {
  const parsedBackground = parseColor(background);
  const parsedForeground = parseColor(foreground);
  if (!parsedBackground || !parsedForeground || parsedBackground[3] < 1) {return null;}
  return ratioForOpaqueColors(composite(parsedForeground, parsedBackground), parsedBackground);
}

export function minimumTextContrast(fontSizePx: number, fontWeight: number): number {
  const largeText = Number.isFinite(fontSizePx) && Number.isFinite(fontWeight)
    && (fontSizePx >= 24 || (fontSizePx >= 18.5 && fontWeight >= 700));
  return largeText ? 3 : 4.5;
}

function numberVariable(value: unknown, fallback: number): number {
  if (typeof value === 'number') {return Number.isFinite(value) ? value : fallback;}
  if (typeof value !== 'string') {return fallback;}
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function opacityVariable(value: unknown, fallback: number): number {
  if (typeof value === 'number') {return Math.max(0, Math.min(1, value));}
  if (typeof value !== 'string') {return fallback;}
  const normalized = value.trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {return fallback;}
  return Math.max(0, Math.min(1, normalized.endsWith('%') ? parsed / 100 : parsed));
}

function check(
  id: string,
  foreground: unknown,
  background: Surface,
  fontSizePx: number,
  fontWeight: number,
): ContrastCheck {
  const minimum = minimumTextContrast(fontSizePx, fontWeight);
  if (!background.color) {return { id, ratio: null, minimum, status: 'unknown', reason: background.reason };}
  const parsedForeground = parseColor(foreground);
  if (!parsedForeground) {return { id, ratio: null, minimum, status: 'unknown', reason: 'unsupported-color' };}
  const ratio = ratioForOpaqueColors(composite(parsedForeground, background.color), background.color);
  return { id, ratio, minimum, status: ratio >= minimum ? 'pass' : 'fail' };
}

function pageSurface(theme: PageTheme): Surface {
  if (theme.backgroundMediaId) {return { color: null, reason: 'background-image' };}
  if (theme.backgroundPreset && theme.backgroundPreset !== 'none') {return { color: null, reason: 'background-preset' };}
  return opaqueSurface(theme.colors.background, null);
}

function sectionSurface(theme: PageTheme, section: PageSection): Surface {
  const parent = pageSurface(theme);
  if (section.design.variant === 'off') {return parent;}
  if (section.design.backgroundMediaId) {
    return section.design.backgroundOverlay >= 1 ? { color: BLACK } : { color: null, reason: 'background-image' };
  }
  const value = section.design.backgroundColor
    || (section.design.variant === 'primary' ? theme.colors.primary
      : section.design.variant === 'secondary' ? theme.colors.surface : 'transparent');
  return opaqueSurface(value, parent);
}

function linkSurface(variables: ReturnType<typeof resolvePublicPageThemeVariables>, parent: Surface, opacityOverride?: number): Surface {
  const opacity = opacityOverride ?? opacityVariable(variables['--theme-link-background-opacity'], 1);
  return opaqueSurface(variables['--theme-link-background'], parent, opacity);
}

function linkChecks(prefix: string, variables: ReturnType<typeof resolvePublicPageThemeVariables>, parent: Surface, titleOnly = false): ContrastCheck[] {
  const surface = linkSurface(variables, parent);
  const title = check(
    `${prefix}.link-title`, variables['--theme-link-title-color'], surface,
    numberVariable(variables['--theme-link-title-fontsize'], 16),
    numberVariable(variables['--theme-link-title-font-weight'], 500),
  );
  if (titleOnly) {return [title];}
  return [title, check(
    `${prefix}.link-subtitle`, variables['--theme-link-subtitle-color'], surface,
    numberVariable(variables['--theme-link-subtitle-fontsize'], 14),
    numberVariable(variables['--theme-link-subtitle-font-weight'], 500),
  )];
}

function unknownChecks(prefix: 'page' | 'section'): ContrastCheck[] {
  return [
    { id: `${prefix}.heading`, ratio: null, minimum: 3, status: 'unknown', reason: 'unknown-surface' },
    { id: `${prefix}.text`, ratio: null, minimum: 4.5, status: 'unknown', reason: 'unknown-surface' },
    { id: `${prefix}.link-title`, ratio: null, minimum: 4.5, status: 'unknown', reason: 'unknown-surface' },
    { id: `${prefix}.link-subtitle`, ratio: null, minimum: 4.5, status: 'unknown', reason: 'unknown-surface' },
  ];
}

export function analyzePageContrast(theme: PageTheme): ContrastCheck[] {
  try {
    const variables = resolvePublicPageThemeVariables(theme);
    const surface = pageSurface(theme);
    return [
      check(
        'page.heading', variables['--theme-heading-color'], surface,
        numberVariable(variables['--theme-h1-fontsize'], theme.tokens.typography.h1.fontSize),
        numberVariable(variables['--theme-h1-font-weight'], theme.tokens.typography.h1.fontWeight),
      ),
      check('page.text', theme.colors.text, surface, 16, 400),
      ...linkChecks('page', variables, surface),
    ];
  } catch {
    return unknownChecks('page');
  }
}

function sectionHeadingMetrics(theme: PageTheme, section: PageSection, level: 'h1' | 'h2' | 'h3'): readonly [number, number] {
  const token = theme.tokens.typography[level];
  if (section.design.variant === 'off') {return [token.fontSize, theme.styleDefaults.headingStyle.fontWeight];}
  return [
    section.design.headingStyle.fontSize ?? token.fontSize,
    section.design.headingStyle.fontWeight ?? theme.styleDefaults.headingStyle.fontWeight,
  ];
}

function sectionTextMetrics(theme: PageTheme, section: PageSection): readonly [number, number] {
  if (section.design.variant === 'off') {
    return [theme.styleDefaults.textStyle.fontSize, theme.styleDefaults.textStyle.fontWeight];
  }
  return [
    section.design.textStyle.fontSize ?? theme.styleDefaults.textStyle.fontSize,
    section.design.textStyle.fontWeight ?? theme.styleDefaults.textStyle.fontWeight,
  ];
}

export function analyzeSectionContrast(theme: PageTheme, section: PageSection): ContrastCheck[] {
  try {
    const variables = resolvePublicPageThemeVariables(theme, section);
    const surface = sectionSurface(theme, section);
    const [headingSize, headingWeight] = sectionHeadingMetrics(theme, section, 'h2');
    const [textSize, textWeight] = sectionTextMetrics(theme, section);
    return [
      check('section.heading', variables['--theme-heading-color'], surface, headingSize, headingWeight),
      check('section.text', variables['--theme-text-color'], surface, textSize, textWeight),
      ...linkChecks('section', variables, surface),
    ];
  } catch {
    return unknownChecks('section');
  }
}

function blockSurface(theme: PageTheme, section: PageSection, block: PageBlock): Surface {
  const parent = sectionSurface(theme, section);
  if (block.design.backgroundMediaId) {
    return block.design.backgroundOverlay >= 1 ? { color: BLACK } : { color: null, reason: 'background-image' };
  }
  return block.design.backgroundColor ? opaqueSurface(block.design.backgroundColor, parent) : parent;
}

function contentText(block: PageBlock, field: string): string {
  return typeof block.content[field] === 'string' ? block.content[field].trim() : '';
}

export function analyzeBlockContrast(theme: PageTheme, section: PageSection, block: PageBlock): ContrastCheck[] {
  try {
    const variables = resolvePublicPageThemeVariables(theme, section);
    const surface = blockSurface(theme, section, block);
    const customText = block.design.textColor?.trim();
    const headingColor = customText || variables['--theme-heading-color'];
    const textColor = customText || variables['--theme-text-color'];
    const checks: ContrastCheck[] = [];
    if (block.type === 'avatar') {
      checks.push(check(
        'block.heading', customText || variables['--avatar-title-color'], surface,
        numberVariable(variables['--avatar-title-size'], theme.tokens.typography.avatarTitle.fontSize),
        numberVariable(variables['--avatar-title-weight'], theme.tokens.typography.avatarTitle.fontWeight),
      ));
      checks.push(check(
        'block.text', customText || variables['--avatar-bio-color'], surface,
        numberVariable(variables['--avatar-bio-size'], theme.tokens.typography.avatarBio.fontSize),
        numberVariable(variables['--avatar-bio-weight'], theme.tokens.typography.avatarBio.fontWeight),
      ));
    } else if (['services', 'contacts', 'faq'].includes(block.type)) {
      const [headingSize, headingWeight] = sectionHeadingMetrics(theme, section, 'h2');
      checks.push(check('block.heading', headingColor, surface, headingSize, headingWeight));
    } else if (block.type === 'text') {
      const [textSize, textWeight] = sectionTextMetrics(theme, section);
      checks.push(check('block.text', textColor, surface, textSize, textWeight));
    }

    if (['button', 'links', 'contacts'].includes(block.type)) {
      const buttonBackground = block.type === 'button' ? contentText(block, 'color') : '';
      const buttonText = block.type === 'button' ? contentText(block, 'textColor') : '';
      const effectiveVariables = buttonBackground || buttonText ? {
        ...variables,
        ...(buttonBackground ? { '--theme-link-background': buttonBackground, '--theme-link-background-opacity': '100%' } : {}),
        ...(buttonText ? { '--theme-link-title-color': buttonText } : {}),
      } : variables;
      const effectiveLinkSurface = buttonBackground
        ? opaqueSurface(buttonBackground, surface)
        : linkSurface(effectiveVariables, surface);
      checks.push(check(
        'block.link-title', effectiveVariables['--theme-link-title-color'], effectiveLinkSurface,
        numberVariable(effectiveVariables['--theme-link-title-fontsize'], 16),
        numberVariable(effectiveVariables['--theme-link-title-font-weight'], 500),
      ));
    }

    if (block.type === 'services') {
      const cardSurface = opaqueSurface(theme.colors.surface, surface);
      const [cardHeadingSize, cardHeadingWeight] = sectionHeadingMetrics(theme, section, 'h3');
      const [cardTextSize, cardTextWeight] = sectionTextMetrics(theme, section);
      checks.push(check('block.card-heading', headingColor, cardSurface, cardHeadingSize, cardHeadingWeight));
      checks.push(check('block.card-text', textColor, cardSurface, cardTextSize, cardTextWeight));
      if (block.content.showBookingButton !== false) {
        const bookingSurface = linkSurface(variables, cardSurface);
        checks.push(check(
          'block.card-link-title', variables['--theme-link-title-color'], bookingSurface,
          numberVariable(variables['--theme-link-title-fontsize'], 16),
          numberVariable(variables['--theme-link-title-font-weight'], 500),
        ));
      }
    } else if (block.type === 'faq') {
      checks.push({ id: 'block.card-content', ratio: null, minimum: 4.5, status: 'unknown', reason: 'nested-surface' });
    }
    return checks;
  } catch {
    return [{ id: 'block.text', ratio: null, minimum: 4.5, status: 'unknown', reason: 'unknown-surface' }];
  }
}
