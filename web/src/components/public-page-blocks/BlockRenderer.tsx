import { Box } from '@mui/material';
import type { PageBlock } from '../../features/public-page-builder/types/publicPage';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import { BlockErrorBoundary } from './BlockErrorBoundary';
import { BlockRenderErrorFallback } from './BlockRenderErrorFallback';
import { UnknownBlockFallback } from './UnknownBlockFallback';

type BlockRendererProps = {
  block: PageBlock;
  mediaUrlFor?: (mediaId: string) => string | undefined;
};

export function BlockRenderer({ block, mediaUrlFor }: BlockRendererProps) {
  if (!block.visible) {
    return null;
  }

  const definition = getBlockDefinition(block.type);
  if (!definition) {
    return <UnknownBlockFallback blockType={block.type} />;
  }

  const Renderer = definition.Renderer;

  const backgroundUrl = block.design.backgroundMediaId ? mediaUrlFor?.(block.design.backgroundMediaId) : undefined;
  return <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 3,
    ...(backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,${block.design.backgroundOverlay}), rgba(0,0,0,${block.design.backgroundOverlay})), url("${backgroundUrl}")`,
      backgroundSize: block.design.backgroundFit, backgroundPosition: block.design.backgroundPosition, backgroundRepeat: 'no-repeat' } : {}),
  }}>
    <BlockErrorBoundary blockId={block.id} fallback={<BlockRenderErrorFallback />}>
      <Renderer block={block} />
    </BlockErrorBoundary>
  </Box>;
}
