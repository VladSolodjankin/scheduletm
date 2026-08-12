import type { PageTheme } from '../types/publicPage';

function themeDefaults(fontFamily: string, text: string, primary: string, surface: string): PageTheme['styleDefaults'] {
  return {
    sectionBorderRadius: 0,
    blockBorderRadius: 24,
    headingStyle: { fontFamily, fontSize: 32, fontWeight: 700, fontStyle: 'normal', color: text },
    textStyle: { fontFamily, fontSize: 16, fontWeight: 400, fontStyle: 'normal', color: text },
    linkStyle: {
      titleStyle: { fontFamily, fontSize: 16, fontWeight: 600, fontStyle: 'normal', color: primary },
      subtitleStyle: { fontFamily, fontSize: 14, fontWeight: 400, fontStyle: 'normal', color: text },
      backgroundColor: surface, backgroundOpacity: 1, borderWidth: 0, borderColor: primary, shadow: false,
    },
  };
}

const defaults = {
  fontFamily: 'Inter, system-ui, sans-serif',
  roundingStyle: 'rounded' as const,
  linkStylePreset: 'primary-fill' as const,
  backgroundMediaId: null,
  backgroundPreset: null,
  backgroundFit: 'cover' as const,
  backgroundPosition: '50% 50%',
};

const themeRows: Array<Omit<PageTheme, keyof typeof defaults | 'styleDefaults'>> = [
  { ...defaults, id: 'sand', name: 'Sand', colors: { background: '#f4ead5', surface: '#fffaf0', text: '#21170b', primary: '#c58f55' } },
  { ...defaults, id: 'mono', name: 'Mono', colors: { background: '#eef1f2', surface: '#ffffff', text: '#25292b', primary: '#cfd7da' } },
  { ...defaults, id: 'sage', name: 'Sage', colors: { background: '#e7f0e6', surface: '#ffffff', text: '#252727', primary: '#c6ddc4' } },
  { ...defaults, id: 'sun', name: 'Sun', colors: { background: '#fff2ce', surface: '#fffaf0', text: '#141718', primary: '#ffd970' } },
  { ...defaults, id: 'sky', name: 'Sky', colors: { background: '#f7f1e5', surface: '#ffffff', text: '#263b4b', primary: '#7ca2b8' } },
  { ...defaults, id: 'berry', name: 'Berry', colors: { background: '#f1f0fa', surface: '#ffffff', text: '#545b6b', primary: '#c00027' } },
  { ...defaults, id: 'stone', name: 'Stone', colors: { background: '#eeeade', surface: '#ffffff', text: '#695f4f', primary: '#9b8d75' } },
  { ...defaults, id: 'forest', name: 'Forest', colors: { background: '#f7f3e9', surface: '#eadcc8', text: '#263846', primary: '#607c65' } },
  { ...defaults, id: 'lime', name: 'Lime', colors: { background: '#f4f5f3', surface: '#ffffff', text: '#cadfb9', primary: '#c7ff65' } },
  { ...defaults, id: 'plum', name: 'Plum', colors: { background: '#f0e8f0', surface: '#ffffff', text: '#80607c', primary: '#8a5e80' } },
  { ...defaults, id: 'blush', name: 'Blush', colors: { background: '#f5eeee', surface: '#ffffff', text: '#dfceca', primary: '#eadbd7' } },
];

export const PUBLIC_PAGE_THEMES: PageTheme[] = themeRows.map((theme) => ({
  ...defaults, ...theme,
  styleDefaults: themeDefaults(defaults.fontFamily, theme.colors.text, theme.colors.primary, theme.colors.surface),
}));

export const DEFAULT_PUBLIC_PAGE_THEME = PUBLIC_PAGE_THEMES[0];
