import { Box } from '@mui/material';
import type { PageBlock } from '../../features/public-page-builder/types/publicPage';
import type { PageTheme } from '../../features/public-page-builder/types/publicPage';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import { BlockErrorBoundary } from './BlockErrorBoundary';
import { BlockRenderErrorFallback } from './BlockRenderErrorFallback';
import { UnknownBlockFallback } from './UnknownBlockFallback';

type BlockRendererProps = {
  block: PageBlock;
  mediaUrlFor?: (mediaId: string) => string | undefined;
  editor?: boolean;
  themeBorderRadius?: number;
  roundingStyle?: PageTheme['roundingStyle'];
};

export function themeRadius(style: PageTheme['roundingStyle'], roundedRadius = 24): string {
  if (style === 'pill') {return '40px';}
  if (style === 'leaf') {return `${roundedRadius}px 4px ${roundedRadius}px 4px`;}
  if (style === 'square') {return '2px';}
  return `${roundedRadius}px`;
}

export function sectionThemeRadius(style: PageTheme['roundingStyle'], roundedRadius = 24): string {
  if (style === 'pill') {return '40px';}
  if (style === 'square') {return '2px';}
  return `${roundedRadius}px`;
}

export function blockSurfaceRadius(borderRadius: number | null, style: PageTheme['roundingStyle'], roundedRadius = 24): string {
  return borderRadius !== null ? `${borderRadius}px` : sectionThemeRadius(style, roundedRadius);
}

export function BlockRenderer({ block, mediaUrlFor, editor = false, themeBorderRadius = 24, roundingStyle = 'rounded' }: BlockRendererProps) {
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
  return <Box sx={{ position: 'relative', opacity: block.visible ? 1 : 0.45,
    pt: `${block.design.paddingTop ?? 0}px`, pb: `${block.design.paddingBottom ?? 0}px`,
    bgcolor: hasSurface ? block.design.backgroundColor ?? 'transparent' : undefined,
    color: block.design.textColor ?? 'inherit',
    borderRadius: hasSurface ? surfaceRadius : undefined,
    overflow: hasSurface ? 'hidden' : undefined,
    ...(backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,${block.design.backgroundOverlay}), rgba(0,0,0,${block.design.backgroundOverlay})), url("${backgroundUrl}")`,
      backgroundSize: block.design.backgroundFit, backgroundPosition: block.design.backgroundPosition, backgroundRepeat: 'no-repeat' } : {}),
  }}>
    <BlockErrorBoundary blockId={block.id} fallback={<BlockRenderErrorFallback />}>
      <Renderer block={block} mediaUrlFor={mediaUrlFor} />
    </BlockErrorBoundary>
  </Box>;
}
