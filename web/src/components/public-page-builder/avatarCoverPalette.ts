import type { BlockContent, PageTheme } from '../../features/public-page-builder/types/publicPage';

type ThemeColors = Pick<PageTheme, 'colors'> & Partial<Pick<PageTheme, 'swatches'>>;

function normalizedColor(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveAvatarCoverPalette(theme: ThemeColors): string[] {
  const colors = theme.swatches ?? [theme.colors.background, theme.colors.surface, theme.colors.primary, theme.colors.text];
  const seen = new Set<string>();

  return colors.flatMap((color) => {
    const value = color.trim();
    const normalized = normalizedColor(value);
    if (!normalized || seen.has(normalized)) {return [];}
    seen.add(normalized);
    return [value];
  });
}

export function resolveSelectedAvatarCoverColor(theme: ThemeColors, coverColor: unknown): string {
  return typeof coverColor === 'string' && coverColor.trim() ? coverColor.trim() : theme.colors.primary;
}

export function applyAvatarCoverColor(content: BlockContent, coverColor: string): BlockContent {
  return { ...content, coverColor, coverMediaId: null };
}

export function isSameAvatarCoverColor(left: string, right: string): boolean {
  return normalizedColor(left) === normalizedColor(right);
}
