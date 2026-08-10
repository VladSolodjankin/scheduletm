export const PUBLIC_PAGE_BACKGROUND_PRESETS = [
  { id: 'none', css: 'none' },
  { id: 'aurora', css: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 48%, #fce7f3 100%)' },
  { id: 'sunrise', css: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 48%, #fecdd3 100%)' },
  { id: 'ocean', css: 'linear-gradient(145deg, #cffafe 0%, #bfdbfe 55%, #c4b5fd 100%)' },
  { id: 'forest', css: 'linear-gradient(145deg, #dcfce7 0%, #a7f3d0 50%, #d9f99d 100%)' },
  { id: 'night', css: 'linear-gradient(145deg, #111827 0%, #312e81 55%, #581c87 100%)' },
  { id: 'rose', css: 'linear-gradient(145deg, #fff1f2 0%, #fbcfe8 52%, #ddd6fe 100%)' },
  { id: 'sand', css: 'linear-gradient(145deg, #fffbeb 0%, #fde68a 48%, #fed7aa 100%)' },
  { id: 'mint', css: 'linear-gradient(145deg, #f0fdfa 0%, #99f6e4 52%, #bae6fd 100%)' },
  { id: 'graphite', css: 'linear-gradient(145deg, #0f172a 0%, #334155 55%, #475569 100%)' },
  { id: 'lavender', css: 'linear-gradient(145deg, #faf5ff 0%, #e9d5ff 52%, #c7d2fe 100%)' },
] as const;

export function backgroundPresetCss(id: string | null): string | undefined {
  const value = PUBLIC_PAGE_BACKGROUND_PRESETS.find((preset) => preset.id === id)?.css;
  return value && value !== 'none' ? value : undefined;
}
