import type { EditorAction } from '../types/actions';
import { EDITOR_HISTORY_LIMIT, type EditorState } from '../types/editor';
import type { PageBlock, PageSection, PublicPageDocument } from '../types/publicPage';
import { normalizeSlug } from './slug';

function cloneDocument(document: PublicPageDocument): PublicPageDocument {
  return structuredClone(document);
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

function insertAt<T>(items: T[], item: T, index = items.length): T[] {
  const next = [...items];
  next.splice(clampIndex(index, next.length), 0, item);
  return next;
}

function reorderById<T extends { id: string }>(items: T[], id: string, toIndex: number): T[] {
  const fromIndex = items.findIndex((item) => item.id === id);
  if (fromIndex < 0) {return items;}
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(clampIndex(toIndex, next.length), 0, item);
  return next;
}

function updateSection(
  sections: PageSection[],
  sectionId: string,
  update: (section: PageSection) => PageSection,
): PageSection[] {
  return sections.map((section) => section.id === sectionId ? update(section) : section);
}

function updateBlock(
  sections: PageSection[],
  sectionId: string,
  blockId: string,
  update: (block: PageBlock) => PageBlock,
): PageSection[] {
  return updateSection(sections, sectionId, (section) => ({
    ...section,
    blocks: section.blocks.map((block) => block.id === blockId ? update(block) : block),
  }));
}

function commit(state: EditorState, document: PublicPageDocument): EditorState {
  if (document === state.document) {return state;}
  return {
    ...state,
    document,
    past: [...state.past, cloneDocument(state.document)].slice(-EDITOR_HISTORY_LIMIT),
    future: [],
    dirty: true,
    saveStatus: state.saveStatus === 'saving' ? 'saving' : 'idle',
    saveError: null,
    publishErrors: [],
  };
}

export function createEditorState(document: PublicPageDocument): EditorState {
  return {
    document: cloneDocument(document),
    past: [],
    future: [],
    selection: { sectionId: null, blockId: null },
    saveStatus: 'idle',
    saveError: null,
    publishErrors: [],
    dirty: false,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'document/replace':
      return createEditorState(action.document);
    case 'profile/update':
      return commit(state, { ...state.document, profile: { ...state.document.profile, ...action.changes } });
    case 'seo/update':
      return commit(state, { ...state.document, seo: { ...state.document.seo, ...action.changes } });
    case 'slug/update':
      return commit(state, { ...state.document, slug: normalizeSlug(action.slug) });
    case 'theme/update':
      return commit(state, { ...state.document, theme: structuredClone(action.theme) });
    case 'section/add':
      return commit(state, {
        ...state.document,
        sections: insertAt(state.document.sections, structuredClone(action.section), action.index),
      });
    case 'section/update':
      return commit(state, {
        ...state.document,
        sections: updateSection(state.document.sections, action.sectionId, (section) => ({
          ...section,
          ...action.changes,
        })),
      });
    case 'section/remove':
      return {
        ...commit(state, {
          ...state.document,
          sections: state.document.sections.filter((section) => section.id !== action.sectionId),
        }),
        selection: state.selection.sectionId === action.sectionId
          ? { sectionId: null, blockId: null }
          : state.selection,
      };
    case 'section/reorder':
      return commit(state, {
        ...state.document,
        sections: reorderById(state.document.sections, action.sectionId, action.toIndex),
      });
    case 'section/toggle':
      return commit(state, {
        ...state.document,
        sections: updateSection(state.document.sections, action.sectionId, (section) => ({
          ...section,
          visible: !section.visible,
        })),
      });
    case 'block/add':
      return commit(state, {
        ...state.document,
        sections: updateSection(state.document.sections, action.sectionId, (section) => ({
          ...section,
          blocks: insertAt(section.blocks, structuredClone(action.block), action.index),
        })),
      });
    case 'block/update':
      return commit(state, {
        ...state.document,
        sections: updateBlock(state.document.sections, action.sectionId, action.blockId, (block) => ({
          ...block,
          ...action.changes,
        })),
      });
    case 'block/design':
      return commit(state, {
        ...state.document,
        sections: updateBlock(state.document.sections, action.sectionId, action.blockId, (block) => ({
          ...block,
          design: { ...block.design, ...action.changes },
        })),
      });
    case 'block/remove':
      return {
        ...commit(state, {
          ...state.document,
          sections: updateSection(state.document.sections, action.sectionId, (section) => ({
            ...section,
            blocks: section.blocks.filter((block) => block.id !== action.blockId),
          })),
        }),
        selection: state.selection.blockId === action.blockId
          ? { sectionId: action.sectionId, blockId: null }
          : state.selection,
      };
    case 'block/reorder':
      return commit(state, {
        ...state.document,
        sections: updateSection(state.document.sections, action.sectionId, (section) => ({
          ...section,
          blocks: reorderById(section.blocks, action.blockId, action.toIndex),
        })),
      });
    case 'block/toggle':
      return commit(state, {
        ...state.document,
        sections: updateBlock(state.document.sections, action.sectionId, action.blockId, (block) => ({
          ...block,
          visible: !block.visible,
        })),
      });
    case 'selection/set':
      return {
        ...state,
        selection: { sectionId: action.sectionId, blockId: action.blockId ?? null },
      };
    case 'selection/clear':
      return { ...state, selection: { sectionId: null, blockId: null } };
    case 'history/undo': {
      const previous = state.past.at(-1);
      if (!previous) {return state;}
      return {
        ...state,
        document: cloneDocument(previous),
        past: state.past.slice(0, -1),
        future: [cloneDocument(state.document), ...state.future].slice(0, EDITOR_HISTORY_LIMIT),
        dirty: true,
        saveStatus: 'idle',
        publishErrors: [],
      };
    }
    case 'history/redo': {
      const next = state.future[0];
      if (!next) {return state;}
      return {
        ...state,
        document: cloneDocument(next),
        past: [...state.past, cloneDocument(state.document)].slice(-EDITOR_HISTORY_LIMIT),
        future: state.future.slice(1),
        dirty: true,
        saveStatus: 'idle',
        publishErrors: [],
      };
    }
    case 'save/status':
      return {
        ...state,
        saveStatus: action.status,
        saveError: action.error ?? null,
        dirty: action.status === 'saved' ? false : state.dirty,
      };
    case 'save/succeeded':
      return {
        ...state,
        document: cloneDocument(action.document),
        dirty: false,
        saveStatus: 'saved',
        saveError: null,
      };
    case 'publish/errors':
      return { ...state, publishErrors: [...action.errors] };
    case 'publish/succeeded':
      return {
        ...state,
        document: cloneDocument(action.document),
        publishErrors: [],
        dirty: false,
        saveStatus: 'saved',
        saveError: null,
      };
  }
}
