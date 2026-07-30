import type { EditorState } from '../types/editor';
import type { PageBlock, PageSection } from '../types/publicPage';

export function selectSelectedSection(state: EditorState): PageSection | null {
  return state.document.sections.find((section) => section.id === state.selection.sectionId) ?? null;
}

export function selectSelectedBlock(state: EditorState): PageBlock | null {
  const section = selectSelectedSection(state);
  return section?.blocks.find((block) => block.id === state.selection.blockId) ?? null;
}

export function selectCanUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function selectCanRedo(state: EditorState): boolean {
  return state.future.length > 0;
}
