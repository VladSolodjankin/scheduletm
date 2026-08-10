import type { PageTheme } from '../types/publicPage';

const defaults = {
  fontFamily: 'Inter, system-ui, sans-serif',
  backgroundMediaId: null,
  backgroundPreset: null,
  backgroundFit: 'cover' as const,
  backgroundPosition: '50% 50%',
};

export const PUBLIC_PAGE_THEMES: PageTheme[] = [
  { ...defaults, id: 'minimal-light', name: 'Minimal Light', colors: { background: '#f8fafc', surface: '#ffffff', text: '#172033', primary: '#315efb' } },
  { ...defaults, id: 'minimal-dark', name: 'Minimal Dark', colors: { background: '#111318', surface: '#1c2028', text: '#f4f6fb', primary: '#8ca6ff' } },
  { ...defaults, id: 'business', name: 'Business', colors: { background: '#eef3f8', surface: '#ffffff', text: '#16324f', primary: '#0066a1' } },
  { ...defaults, id: 'beauty', name: 'Beauty', colors: { background: '#fff4f7', surface: '#ffffff', text: '#4b2636', primary: '#b64f79' } },
  { ...defaults, id: 'creative', name: 'Creative', colors: { background: '#fffbea', surface: '#ffffff', text: '#24203d', primary: '#7257fa' } },
  { ...defaults, id: 'warm', name: 'Warm', colors: { background: '#fff7ed', surface: '#fffbf5', text: '#512f20', primary: '#c65d32' } },
  { ...defaults, id: 'contrast', name: 'Contrast', colors: { background: '#ffffff', surface: '#ffffff', text: '#000000', primary: '#0047ff' } },
  { ...defaults, id: 'gradient', name: 'Gradient', colors: { background: '#ede9fe', surface: '#ffffff', text: '#241849', primary: '#7c3aed' } },
];

export const DEFAULT_PUBLIC_PAGE_THEME = PUBLIC_PAGE_THEMES[0];
