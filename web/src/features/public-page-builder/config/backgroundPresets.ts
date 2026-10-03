export type PublicPageBackgroundCategory = 'neutral' | 'bright' | 'dark';

export const PUBLIC_PAGE_BACKGROUND_CATEGORIES: readonly PublicPageBackgroundCategory[] = ['neutral', 'bright', 'dark'];

export const PUBLIC_PAGE_BACKGROUND_PRESETS = [
  { id: 'none', css: 'none', category: null },
  { id: 'aurora', css: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 48%, #fce7f3 100%)', category: 'neutral' },
  { id: 'sunrise', css: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 48%, #fecdd3 100%)', category: 'neutral' },
  { id: 'ocean', css: 'linear-gradient(145deg, #cffafe 0%, #bfdbfe 55%, #c4b5fd 100%)', category: 'neutral' },
  { id: 'forest', css: 'linear-gradient(145deg, #dcfce7 0%, #a7f3d0 50%, #d9f99d 100%)', category: 'neutral' },
  { id: 'rose', css: 'linear-gradient(145deg, #fff1f2 0%, #fbcfe8 52%, #ddd6fe 100%)', category: 'neutral' },
  { id: 'sand', css: 'linear-gradient(145deg, #fffbeb 0%, #fde68a 48%, #fed7aa 100%)', category: 'neutral' },
  { id: 'mint', css: 'linear-gradient(145deg, #f0fdfa 0%, #99f6e4 52%, #bae6fd 100%)', category: 'neutral' },
  { id: 'lavender', css: 'linear-gradient(145deg, #faf5ff 0%, #e9d5ff 52%, #c7d2fe 100%)', category: 'neutral' },
  { id: 'citrus', css: 'linear-gradient(140deg, #fde047 0%, #fb923c 55%, #f97316 100%)', category: 'bright' },
  { id: 'coral', css: 'linear-gradient(140deg, #fb7185 0%, #f97316 52%, #facc15 100%)', category: 'bright' },
  { id: 'electric', css: 'linear-gradient(140deg, #22d3ee 0%, #6366f1 55%, #a855f7 100%)', category: 'bright' },
  { id: 'berry', css: 'linear-gradient(140deg, #f472b6 0%, #c026d3 52%, #7c3aed 100%)', category: 'bright' },
  { id: 'night', css: 'linear-gradient(145deg, #111827 0%, #312e81 55%, #581c87 100%)', category: 'dark' },
  { id: 'graphite', css: 'linear-gradient(145deg, #0f172a 0%, #334155 55%, #475569 100%)', category: 'dark' },
  { id: 'obsidian', css: 'linear-gradient(150deg, #0a0a0b 0%, #1c1917 52%, #27211d 100%)', category: 'dark' },
] as const;

export function backgroundPresetCss(id: string | null): string | undefined {
  const value = PUBLIC_PAGE_BACKGROUND_PRESETS.find((preset) => preset.id === id)?.css;
  return value && value !== 'none' ? value : undefined;
}
