export type ThemeMode = 'light' | 'dark';

export type PaletteVariantId =
  | 'ocean'
  | 'sage'
  | 'sunset'
  | 'lavender'
  | 'graphite';

export type PaletteVariant = {
  id: PaletteVariantId;
  label: string;
  light: {
    primary: string;
    secondary: string;
    backgroundDefault: string;
    backgroundPaper: string;
  };
  dark: {
    primary: string;
    secondary: string;
    backgroundDefault: string;
    backgroundPaper: string;
  };
};

export const APP_SIZING = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  headerHeight: 64,
  leftMenuWidth: 260,
  contentMaxWidth: 1200
} as const;

export const APP_SPACING = {
  pageX: { xs: 2, md: 3 },
  pageY: { xs: 2, md: 3 },
  sectionGap: 2,
  formGap: 2
} as const;

export const PALETTE_VARIANTS: readonly PaletteVariant[] = [
  {
    id: 'ocean',
    label: 'Ocean Blue',
    light: {
      primary: 'hsl(210, 100%, 38%)',
      secondary: 'hsl(195, 72%, 46%)',
      backgroundDefault: 'hsl(210, 35%, 97%)',
      backgroundPaper: 'hsl(0, 0%, 100%)'
    },
    dark: {
      primary: 'hsl(210, 100%, 62%)',
      secondary: 'hsl(195, 75%, 58%)',
      backgroundDefault: 'hsl(218, 33%, 12%)',
      backgroundPaper: 'hsl(218, 29%, 16%)'
    }
  },
  {
    id: 'sage',
    label: 'Sage Mint',
    light: {
      primary: 'hsl(163, 43%, 40%)',
      secondary: 'hsl(186, 53%, 42%)',
      backgroundDefault: 'hsl(160, 22%, 96%)',
      backgroundPaper: 'hsl(0, 0%, 100%)'
    },
    dark: {
      primary: 'hsl(163, 48%, 58%)',
      secondary: 'hsl(186, 57%, 62%)',
      backgroundDefault: 'hsl(173, 18%, 12%)',
      backgroundPaper: 'hsl(173, 17%, 16%)'
    }
  },
  {
    id: 'sunset',
    label: 'Sunset Coral',
    light: {
      primary: 'hsl(18, 74%, 52%)',
      secondary: 'hsl(37, 80%, 52%)',
      backgroundDefault: 'hsl(28, 42%, 96%)',
      backgroundPaper: 'hsl(0, 0%, 100%)'
    },
    dark: {
      primary: 'hsl(18, 83%, 63%)',
      secondary: 'hsl(37, 89%, 63%)',
      backgroundDefault: 'hsl(18, 18%, 11%)',
      backgroundPaper: 'hsl(18, 16%, 15%)'
    }
  },
  {
    id: 'lavender',
    label: 'Lavender',
    light: {
      primary: 'hsl(262, 56%, 52%)',
      secondary: 'hsl(281, 59%, 58%)',
      backgroundDefault: 'hsl(255, 40%, 97%)',
      backgroundPaper: 'hsl(0, 0%, 100%)'
    },
    dark: {
      primary: 'hsl(262, 76%, 68%)',
      secondary: 'hsl(281, 72%, 69%)',
      backgroundDefault: 'hsl(251, 24%, 12%)',
      backgroundPaper: 'hsl(251, 22%, 16%)'
    }
  },
  {
    id: 'graphite',
    label: 'Graphite Teal',
    light: {
      primary: 'hsl(210, 30%, 34%)',
      secondary: 'hsl(192, 54%, 40%)',
      backgroundDefault: 'hsl(210, 22%, 95%)',
      backgroundPaper: 'hsl(0, 0%, 100%)'
    },
    dark: {
      primary: 'hsl(210, 18%, 72%)',
      secondary: 'hsl(192, 72%, 64%)',
      backgroundDefault: 'hsl(210, 18%, 10%)',
      backgroundPaper: 'hsl(210, 15%, 14%)'
    }
  }
] as const;

export const DEFAULT_PALETTE_VARIANT_ID: PaletteVariantId = 'ocean';
