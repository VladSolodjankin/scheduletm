import { Box } from '@mui/material';
import type { PageBlock } from '../../features/public-page-builder/types/publicPage';
import type { PageTheme } from '../../features/public-page-builder/types/publicPage';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import { BlockErrorBoundary } from './BlockErrorBoundary';
import { BlockRenderErrorFallback } from './BlockRenderErrorFallback';
import { UnknownBlockFallback } from './UnknownBlockFallback';
import type { PublicBookingService } from '../../shared/types/api';

type BlockRendererProps = {
  block: PageBlock;
  mediaUrlFor?: (mediaId: string) => string | undefined;
  editor?: boolean;
  themeBorderRadius?: number;
  roundingStyle?: PageTheme['roundingStyle'];
  services?: readonly PublicBookingService[];
  publicPageSlug?: string;
};

export function sectionThemeRadius(_style: PageTheme['roundingStyle'], roundedRadius = 40): string {
  return `${roundedRadius}px`;
}

export function sectionSurfaceRadius(borderRadius: number | null, style: PageTheme['roundingStyle'], roundedRadius = 40): string {
  return borderRadius !== null ? `${borderRadius}px` : sectionThemeRadius(style, roundedRadius);
}

export function blockSurfaceRadius(borderRadius: number | null, style: PageTheme['roundingStyle'], roundedRadius = 40): string {
  return borderRadius !== null ? `${borderRadius}px` : sectionThemeRadius(style, roundedRadius);
}

export function BlockRenderer({ block, mediaUrlFor, editor = false, themeBorderRadius = 40, roundingStyle = 'rounded', services, publicPageSlug }: BlockRendererProps) {
  if (!block.visible && !editor) {
    return null;
  }

  const definition = getBlockDefinition(block.type);
  if (!definition) {
    return <UnknownBlockFallback blockType={block.type} />;
  }

  const Renderer = definition.Renderer;

  const backgroundUrl = block.design.backgroundMediaId ? mediaUrlFor?.(block.design.backgroundMediaId) : undefined;
  const hasSurface = Boolean(block.design.backgroundColor || block.design.backgroundMediaId);
  const surfaceRadius = blockSurfaceRadius(block.design.borderRadius, roundingStyle, themeBorderRadius);
  const customTextVariables = block.design.textColor ? {
    '--page-section-text': block.design.textColor,
    '--theme-heading-color': block.design.textColor,
    '--theme-text-color': block.design.textColor,
    '--avatar-title-color': block.design.textColor,
    '--avatar-bio-color': block.design.textColor,
  } : {};
  const link = block.design.linkStyle;
  const linkVariables: Record<string, string | number> = {};
  if (link) {
    for (const [part, style] of [['title', link.titleStyle], ['subtitle', link.subtitleStyle]] as const) {
      for (const [key, css] of [['fontFamily', 'font-family'], ['fontWeight', 'font-weight'], ['fontStyle', 'font-style'], ['color', 'color']] as const) {
        if (style[key] !== null) {linkVariables[`--theme-link-${part}-${css}`] = style[key];}
      }
      if (style.fontSize !== null) {linkVariables[`--theme-link-${part}-fontsize`] = `${style.fontSize / 16}rem`;}
    }
    if (link.backgroundColor !== null) {linkVariables['--theme-link-background'] = link.backgroundColor;}
    if (link.backgroundOpacity !== null) {linkVariables['--theme-link-background-opacity'] = `${link.backgroundOpacity * 100}%`;}
    if (link.borderColor !== null) {linkVariables['--theme-link-border-color'] = link.borderColor;}
    if (link.borderWidth !== null) {linkVariables['--theme-link-border-width'] = `${link.borderWidth}px`;}
    if (link.shadow !== null) {linkVariables['--theme-link-shadow-params'] = link.shadow ? '0 5px 17px rgb(23 32 51 / 15%)' : 'none';}
  }
  if (block.design.borderRadius !== null) {linkVariables['--theme-link-border-radius'] = `${block.design.borderRadius}px`;}
  return <Box sx={{ position: 'relative', opacity: block.visible ? 1 : 0.45,
    pt: `${block.design.paddingTop ?? 0}px`, pb: `${block.design.paddingBottom ?? 0}px`,
    bgcolor: hasSurface ? block.design.backgroundColor ?? 'transparent' : undefined,
    color: block.design.textColor ?? 'inherit',
    ...customTextVariables,
    ...linkVariables,
    borderRadius: hasSurface ? surfaceRadius : undefined,
    overflow: hasSurface ? 'hidden' : undefined,
    ...(backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,${block.design.backgroundOverlay}), rgba(0,0,0,${block.design.backgroundOverlay})), url("${backgroundUrl}")`,
      backgroundSize: block.design.backgroundFit, backgroundPosition: block.design.backgroundPosition, backgroundRepeat: 'no-repeat' } : {}),
  }}>
    <BlockErrorBoundary blockId={block.id} fallback={<BlockRenderErrorFallback />}>
      <Renderer block={block} mediaUrlFor={mediaUrlFor} editor={editor} services={services} publicPageSlug={publicPageSlug} />
    </BlockErrorBoundary>
  </Box>;
}
