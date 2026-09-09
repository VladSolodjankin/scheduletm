export type ThemeMode = 'light' | 'dark';

export type PaletteVariantId = 'default';

export type AppColorTokens = {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySoft: string;
  accent: string;
  onPrimary: string;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  disabled: string;
  border: string;
  borderStrong: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  actionHover: string;
  actionSelected: string;
  focusRing: string;
  overlay: string;
};

export const APP_TOKENS = {
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  space: { xs: '0.25rem', s: '0.5rem', m: '1rem', l: '1.5rem', xl: '2rem' },
  fontSize: { xs: '0.75rem', s: '0.875rem', m: '1rem', l: '1.25rem', xl: '1.75rem' },
  typography: {
    headingXl: { fontSize: '1.75rem', lineHeight: '2.1875rem', letterSpacing: '-0.01875rem', fontWeight: 700 },
    headingL: { fontSize: '1.25rem', lineHeight: '1.625rem', letterSpacing: '-0.00625rem', fontWeight: 700 },
    headingM: { fontSize: '1rem', lineHeight: '1.5rem', letterSpacing: 0, fontWeight: 600 },
    bodyM: { fontSize: '1rem', lineHeight: '1.5rem', letterSpacing: 0, fontWeight: 400 },
    bodyS: { fontSize: '0.875rem', lineHeight: '1.25rem', letterSpacing: 0, fontWeight: 400 },
    labelS: { fontSize: '0.875rem', lineHeight: '1.25rem', letterSpacing: 0, fontWeight: 600 },
    captionXs: { fontSize: '0.75rem', lineHeight: '1.125rem', letterSpacing: 0, fontWeight: 400 },
    buttonS: { fontSize: '0.875rem', lineHeight: '1.25rem', letterSpacing: 0, fontWeight: 600 },
  },
  radius: {
    xs: '0.25rem',
    s: '0.5rem',
    m: '1rem',
    l: '1.5rem',
    xl: '2rem',
    pill: '999rem',
    circle: '50%',
  },
  fontWeight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { compact: 1.25, default: 1.5, relaxed: 1.65 },
  controlHeight: { s: '2rem', m: '2.5rem', l: '3rem' },
  iconSize: { xs: '0.75rem', s: '1rem', m: '1.25rem', l: '1.5rem', xl: '2rem' },
  avatarSize: { xs: '1.5rem', s: '2rem', m: '2.5rem', l: '3rem', xl: '4rem' },
  motion: {
    fast: '120ms',
    default: '160ms',
    slow: '240ms',
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  layout: {
    sidebar: '20rem',
    pageMax: '100rem',
    pageNarrow: '56rem',
    dialogS: '30rem',
    dialogM: '40rem',
    dialogL: '56rem',
    header: '4rem',
  },
  border: { width: '0.0625rem' },
  publicPageBase: {
    // Fixed base metrics for rendered Public Page content, independent of the cabinet profile.
    muiRadiusMultiplier: 14,
    controlHeightM: '2.625rem',
  },
  shadow: {
    softLight: '0 0.625rem 1.875rem rgba(15, 23, 42, 0.05)',
    surfaceLight: '0 1.5rem 3.75rem rgba(15, 23, 42, 0.08)',
    softDark: '0 0.625rem 1.75rem rgba(2, 6, 23, 0.24)',
    surfaceDark: '0 1.5rem 3.75rem rgba(2, 6, 23, 0.32)',
  },
  zIndex: { header: 1100, drawer: 1200, modal: 1300, tooltip: 1500 },
  colors: {
    light: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primaryActive: '#1e40af',
      primarySoft: '#eff6ff',
      accent: '#0891b2',
      onPrimary: '#ffffff',
      canvas: '#f6f8fc',
      surface: '#ffffff',
      surfaceMuted: '#f1f5f9',
      text: '#0f172a',
      textMuted: '#475569',
      disabled: '#94a3b8',
      border: '#e2e8f0',
      borderStrong: '#cbd5e1',
      success: '#15803d',
      successSoft: '#f0fdf4',
      warning: '#b45309',
      warningSoft: '#fffbeb',
      danger: '#dc2626',
      dangerSoft: '#fef2f2',
      info: '#0369a1',
      infoSoft: '#f0f9ff',
      actionHover: 'rgba(15, 23, 42, 0.05)',
      actionSelected: 'rgba(37, 99, 235, 0.1)',
      focusRing: 'rgba(37, 99, 235, 0.24)',
      overlay: 'rgba(15, 23, 42, 0.48)',
    },
    dark: {
      primary: '#60a5fa',
      primaryHover: '#93c5fd',
      primaryActive: '#3b82f6',
      primarySoft: '#172554',
      accent: '#22d3ee',
      onPrimary: '#0b1220',
      canvas: '#0b1220',
      surface: '#111827',
      surfaceMuted: '#172033',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      disabled: '#64748b',
      border: '#263244',
      borderStrong: '#3b475a',
      success: '#4ade80',
      successSoft: '#052e16',
      warning: '#fbbf24',
      warningSoft: '#422006',
      danger: '#f87171',
      dangerSoft: '#450a0a',
      info: '#38bdf8',
      infoSoft: '#082f49',
      actionHover: 'rgba(248, 250, 252, 0.08)',
      actionSelected: 'rgba(96, 165, 250, 0.14)',
      focusRing: 'rgba(96, 165, 250, 0.3)',
      overlay: 'rgba(2, 6, 23, 0.72)',
    },
  } satisfies Record<ThemeMode, AppColorTokens>,
} as const;

export const DEFAULT_PALETTE_VARIANT_ID: PaletteVariantId = 'default';

// Compatibility aliases for established consumers. New UI uses APP_TOKENS or CSS variables.
export const rem = (value: number | string) => typeof value === 'string' ? value : `${value / 16}rem`;

export const APP_SIZING = {
  radiusXs: APP_TOKENS.radius.xs,
  radiusSm: APP_TOKENS.radius.s,
  radiusMd: APP_TOKENS.radius.m,
  radiusLg: APP_TOKENS.radius.l,
  radiusXl: APP_TOKENS.radius.xl,
  surfaceRadius: APP_TOKENS.radius.m,
  headerHeight: 64,
  leftMenuWidth: 320,
  contentMaxWidth: 1600,
} as const;

export const APP_SPACING = {
  pageX: { xs: 2, sm: 3, lg: 4 },
  pageY: { xs: 2.5, sm: 3, lg: 4 },
  sectionGap: 2.5,
  formGap: 2,
  surfacePadding: 2,
  cardPadding: { xs: 2, sm: 2.5, lg: 3 },
  pageHeaderGap: 0.75,
} as const;

export const APP_SHADOWS = {
  surfaceLight: APP_TOKENS.shadow.surfaceLight,
  surfaceDark: APP_TOKENS.shadow.surfaceDark,
  softLight: APP_TOKENS.shadow.softLight,
  softDark: APP_TOKENS.shadow.softDark,
} as const;

export const PALETTE_VARIANTS = [{
  id: DEFAULT_PALETTE_VARIANT_ID,
  label: 'Meetli',
  light: APP_TOKENS.colors.light,
  dark: APP_TOKENS.colors.dark,
}] as const;
