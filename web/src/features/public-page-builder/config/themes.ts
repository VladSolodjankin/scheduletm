import type {
  PageTheme,
  PageThemeTokens,
  ThemeSwatches,
  ThemeTypographyToken,
} from '../types/publicPage';

const PAGE_TEXT = '#291d0a';
const INTER = 'Inter, sans-serif';
const ROBOTO = 'Roboto, sans-serif';

type ThemeRow = {
  id: string;
  swatches: ThemeSwatches;
  surface: string;
  primary: string;
  linkTitle: string;
  linkShadow: string;
  contrast: string;
};

const typographyToken = (
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  lineHeight: number,
  letterSpacing = 0,
): ThemeTypographyToken => ({ fontFamily, fontSize, fontWeight, lineHeight, letterSpacing });

function createTokens(row: ThemeRow): PageThemeTokens {
  return {
    colors: {
      contrast: row.contrast,
      linkTitle: row.linkTitle,
      linkSubtitle: row.linkTitle,
      linkShadow: row.linkShadow,
      linkBorder: row.primary,
      focus: row.primary,
      checkboxBackground: row.primary,
    },
    typography: {
      fontFamily: INTER,
      fontWeight: 500,
      boldFontWeight: 800,
      headingColor: PAGE_TEXT,
      avatarTitle: typographyToken(ROBOTO, 16, 700, 1.2),
      avatarBio: typographyToken(ROBOTO, 16, 400, 1.2),
      linkTitle: typographyToken(INTER, 16, 500, 1.2),
      linkSubtitle: typographyToken(INTER, 14, 500, 1.2),
      h1: typographyToken(INTER, 50, 800, 1.15),
      h2: typographyToken(INTER, 30, 800, 1.25, 2),
      h3: typographyToken(INTER, 24, 800, 1.4),
      textLarge: typographyToken(INTER, 20, 500, 1.45),
      textMedium: typographyToken(INTER, 17, 500, 1.45, 1),
      textSmall: typographyToken(INTER, 14, 500, 1.45),
    },
    layout: { blockRadius: 40, linkRadius: 40, linkGap: 10 },
  };
}

function createStyleDefaults(tokens: PageThemeTokens, colors: PageTheme['colors']): PageTheme['styleDefaults'] {
  return {
    sectionBorderRadius: tokens.layout.blockRadius,
    blockBorderRadius: tokens.layout.blockRadius,
    headingStyle: {
      fontFamily: tokens.typography.h2.fontFamily,
      fontSize: tokens.typography.h2.fontSize,
      fontWeight: tokens.typography.boldFontWeight,
      fontStyle: 'normal',
      color: tokens.typography.headingColor,
    },
    textStyle: {
      fontFamily: tokens.typography.textMedium.fontFamily,
      fontSize: tokens.typography.textMedium.fontSize,
      fontWeight: tokens.typography.fontWeight,
      fontStyle: 'normal',
      color: colors.text,
    },
    linkStyle: {
      titleStyle: {
        fontFamily: tokens.typography.linkTitle.fontFamily,
        fontSize: tokens.typography.linkTitle.fontSize,
        fontWeight: tokens.typography.linkTitle.fontWeight,
        fontStyle: 'normal',
        color: tokens.colors.linkTitle,
      },
      subtitleStyle: {
        fontFamily: tokens.typography.linkSubtitle.fontFamily,
        fontSize: tokens.typography.linkSubtitle.fontSize,
        fontWeight: tokens.typography.linkSubtitle.fontWeight,
        fontStyle: 'normal',
        color: tokens.colors.linkSubtitle,
      },
      backgroundColor: colors.primary,
      backgroundOpacity: 1,
      borderWidth: 0,
      borderColor: tokens.colors.linkBorder,
      shadow: false,
    },
  };
}

const themeRows: readonly ThemeRow[] = [
  { id: 'z101', swatches: ['#f5f5f5', '#313233', '#D1D9DB', '#E4E7E9'], surface: '#fff', primary: '#313233', linkTitle: '#fff', linkShadow: '#00000033', contrast: '#ffffff' },
  { id: 'z102', swatches: ['#e1ecdf', '#ffffff', '#303030', '#CCDFC9'], surface: '#eff5ee', primary: '#fff', linkTitle: '#1a1a1a', linkShadow: '#c2c2c233', contrast: '#000000' },
  { id: 'z103', swatches: ['#FFF2CF', '#151515', '#F2D589', '#FEE6A5'], surface: '#fff3d2', primary: '#151515', linkTitle: '#fff', linkShadow: '#00000033', contrast: '#ffffff' },
  { id: 'z104', swatches: ['#FEFAEF', '#7194AA', '#7194AA', '#F3E9D5'], surface: '#f7f3e9', primary: '#7194AA', linkTitle: '#fff', linkShadow: '#3a5e7233', contrast: '#ffffff' },
  { id: 'z105', swatches: ['#FFFFFF', '#575E70', '#AA0428', '#EFEFFB'], surface: '#f3f3f3', primary: '#575E70', linkTitle: '#fff', linkShadow: '#262d3d33', contrast: '#ffffff' },
  { id: 'z106', swatches: ['#EAE7DC', '#948369', '#A39686', '#CBC8C1'], surface: '#f5f4ee', primary: '#948369', linkTitle: '#fff', linkShadow: '#5d4e3633', contrast: '#ffffff' },
  { id: 'z107', swatches: ['#fffaf4', '#5d755d', '#5d755d', '#ebdece'], surface: '#fff', primary: '#5d755d', linkTitle: '#fff', linkShadow: '#2b412c33', contrast: '#ffffff' },
  { id: 'z108', swatches: ['#FDFDFD', '#DAFF89', '#C7D8B6', '#EEEEEE'], surface: '#f3f3f3', primary: '#DAFF89', linkTitle: '#233300', linkShadow: '#9dc25033', contrast: '#000000' },
  { id: 'z109', swatches: ['#ede2ea', '#7c5872', '#D1BFCD', '#7C5872'], surface: '#fff', primary: '#7c5872', linkTitle: '#fff', linkShadow: '#00000033', contrast: '#ffffff' },
  { id: 'z110', swatches: ['#f5f5f5', '#e2d4ce', '#E9DFDA', '#E2D4CE'], surface: '#E9DFDA', primary: '#e2d4ce', linkTitle: '#201713', linkShadow: '#00000033', contrast: '#000000' },
];

function createTheme(row: ThemeRow): PageTheme {
  const colors = { background: row.swatches[0], surface: row.surface, text: PAGE_TEXT, primary: row.primary };
  const tokens = createTokens(row);
  return {
    id: row.id,
    name: row.id,
    swatches: row.swatches,
    colors,
    tokens,
    fontFamily: INTER,
    roundingStyle: 'rounded',
    linkStylePreset: 'primary-fill',
    backgroundMediaId: null,
    backgroundPreset: null,
    backgroundFit: 'cover',
    backgroundPosition: '50% 50%',
    styleDefaults: createStyleDefaults(tokens, colors),
  };
}

export const PUBLIC_PAGE_THEMES: PageTheme[] = themeRows.map(createTheme);
export const DEFAULT_PUBLIC_PAGE_THEME = PUBLIC_PAGE_THEMES[0];

export function findPublicPageTheme(themeId: string): PageTheme | undefined {
  return PUBLIC_PAGE_THEMES.find((theme) => theme.id === themeId);
}

export function readableTextColor(background: string): string {
  const normalized = background.trim().replace(/^#([\da-f])([\da-f])([\da-f])$/i, '#$1$1$2$2$3$3');
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(normalized);
  if (!match) {return PAGE_TEXT;}
  const [red, green, blue] = match.slice(1).map((value) => Number.parseInt(value, 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 150 ? PAGE_TEXT : '#ffffff';
}

function shadowColor(text: string): string {
  return /^#[\da-f]{6}$/i.test(text) ? `${text}33` : '#00000033';
}

export function applyPublicPagePalette(current: PageTheme, palette: PageTheme): PageTheme {
  return {
    ...structuredClone(palette),
    backgroundMediaId: current.backgroundMediaId,
    backgroundPreset: current.backgroundPreset,
    backgroundFit: current.backgroundFit,
    backgroundPosition: current.backgroundPosition,
  };
}

export function applyPublicPageThemeColors(
  theme: PageTheme,
  changes: Partial<PageTheme['colors']>,
): PageTheme {
  const colors = { ...theme.colors, ...changes };
  const contrast = readableTextColor(colors.primary);
  const primaryLink = !theme.linkStylePreset.startsWith('surface-');
  const linkTitle = primaryLink ? contrast : colors.text;
  const tokens: PageThemeTokens = {
    ...theme.tokens,
    colors: {
      ...theme.tokens.colors,
      contrast,
      linkTitle,
      linkSubtitle: linkTitle,
      linkShadow: shadowColor(colors.text),
      linkBorder: colors.primary,
      focus: colors.primary,
      checkboxBackground: colors.primary,
    },
    typography: { ...theme.tokens.typography, headingColor: colors.text },
  };
  const styleDefaults = createStyleDefaults(tokens, colors);
  const surfaceLink = theme.linkStylePreset.startsWith('surface-');
  styleDefaults.linkStyle.backgroundColor = surfaceLink ? colors.surface : colors.primary;
  styleDefaults.linkStyle.borderWidth = theme.linkStylePreset.endsWith('outline') ? 1 : 0;
  styleDefaults.linkStyle.shadow = theme.linkStylePreset.includes('shadow') || theme.linkStylePreset.endsWith('strong');
  return {
    ...theme,
    id: 'custom',
    name: 'Custom',
    swatches: [colors.background, colors.primary, colors.surface, colors.text],
    colors,
    tokens,
    styleDefaults,
  };
}

export function applyPublicPageThemeFont(theme: PageTheme, fontFamily: string): PageTheme {
  const typography = Object.fromEntries(Object.entries(theme.tokens.typography).map(([key, value]) => (
    typeof value === 'object' ? [key, { ...value, fontFamily }] : [key, value]
  ))) as PageThemeTokens['typography'];
  typography.fontFamily = fontFamily;
  return {
    ...theme,
    id: 'custom',
    name: 'Custom',
    fontFamily,
    tokens: { ...theme.tokens, typography },
    styleDefaults: {
      ...theme.styleDefaults,
      headingStyle: { ...theme.styleDefaults.headingStyle, fontFamily },
      textStyle: { ...theme.styleDefaults.textStyle, fontFamily },
      linkStyle: {
        ...theme.styleDefaults.linkStyle,
        titleStyle: { ...theme.styleDefaults.linkStyle.titleStyle, fontFamily },
        subtitleStyle: { ...theme.styleDefaults.linkStyle.subtitleStyle, fontFamily },
      },
    },
  };
}

export function applyPublicPageThemeRounding(
  theme: PageTheme,
  roundingStyle: PageTheme['roundingStyle'],
): PageTheme {
  return { ...theme, id: 'custom', name: 'Custom', roundingStyle };
}

export function applyPublicPageLinkStyle(
  theme: PageTheme,
  linkStylePreset: PageTheme['linkStylePreset'],
): PageTheme {
  const surface = linkStylePreset.startsWith('surface-');
  const outline = linkStylePreset.endsWith('outline');
  const shadow = linkStylePreset.includes('shadow') || linkStylePreset.endsWith('strong');
  const titleColor = surface ? theme.colors.text : theme.tokens.colors.linkTitle;
  return {
    ...theme,
    id: 'custom',
    name: 'Custom',
    linkStylePreset,
    styleDefaults: {
      ...theme.styleDefaults,
      linkStyle: {
        ...theme.styleDefaults.linkStyle,
        backgroundColor: surface ? theme.colors.surface : theme.colors.primary,
        borderColor: theme.tokens.colors.linkBorder,
        borderWidth: outline ? 1 : 0,
        shadow,
        titleStyle: { ...theme.styleDefaults.linkStyle.titleStyle, color: titleColor },
        subtitleStyle: { ...theme.styleDefaults.linkStyle.subtitleStyle, color: titleColor },
      },
    },
  };
}
