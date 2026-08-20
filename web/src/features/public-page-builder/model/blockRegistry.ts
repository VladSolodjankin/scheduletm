import type { ComponentType, ReactNode } from 'react';
import type { BlockContent, BlockDesign, PageBlock, PageSection, PageTheme } from '../types/publicPage';
import { createStableId } from '../utils/createStableId';

export type BlockComponentProps = {
  block: PageBlock;
  mediaUrlFor?: (mediaId: string) => string | undefined;
  onContentChange?: (content: BlockContent) => void;
  avatarMediaControl?: ReactNode;
  avatarCoverControl?: ReactNode;
  pageTheme?: PageTheme;
  pageSection?: PageSection;
};

export type BlockDefinition = {
  type: string;
  name: string;
  createContent: () => BlockContent;
  createDesign?: () => BlockDesign;
  Renderer: ComponentType<BlockComponentProps>;
  Editor?: ComponentType<BlockComponentProps>;
  validate?: (block: PageBlock) => string[];
};

const definitions = new Map<string, BlockDefinition>();

export function registerBlock(definition: BlockDefinition): void {
  if (definitions.has(definition.type)) {
    throw new Error(`Block type is already registered: ${definition.type}`);
  }

  definitions.set(definition.type, definition);
}

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return definitions.get(type);
}

export function getBlockDefinitions(): BlockDefinition[] {
  return Array.from(definitions.values());
}

export function createBlock(type: string): PageBlock | null {
  const definition = getBlockDefinition(type);
  if (!definition) {
    return null;
  }

  return {
    id: createStableId(),
    type: definition.type,
    name: definition.name,
    visible: true,
    content: definition.createContent(),
    design: definition.createDesign?.() ?? {
      backgroundColor: null,
      textColor: null,
      backgroundMediaId: null,
      backgroundOverlay: 0,
      backgroundFit: 'cover',
      backgroundPosition: '50% 50%',
      paddingTop: 0,
      paddingBottom: 0,
      borderRadius: null,
    },
  };
}
