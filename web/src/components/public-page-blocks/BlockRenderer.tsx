import type { PageBlock } from '../../features/public-page-builder/types/publicPage';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import { BlockErrorBoundary } from './BlockErrorBoundary';
import { BlockRenderErrorFallback } from './BlockRenderErrorFallback';
import { UnknownBlockFallback } from './UnknownBlockFallback';

type BlockRendererProps = {
  block: PageBlock;
};

export function BlockRenderer({ block }: BlockRendererProps) {
  if (!block.visible) {
    return null;
  }

  const definition = getBlockDefinition(block.type);
  if (!definition) {
    return <UnknownBlockFallback blockType={block.type} />;
  }

  const Renderer = definition.Renderer;

  return (
    <BlockErrorBoundary blockId={block.id} fallback={<BlockRenderErrorFallback />}>
      <Renderer block={block} />
    </BlockErrorBoundary>
  );
}
