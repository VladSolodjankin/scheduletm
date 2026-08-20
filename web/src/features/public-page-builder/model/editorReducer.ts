import type { EditorAction } from '../types/actions';
import { EDITOR_HISTORY_LIMIT, type EditorState } from '../types/editor';
import type { PageBlock, PageSection, PublicPageDocument } from '../types/publicPage';
import { normalizeSlug } from './slug';
import { documentReferencesMedia } from './media';
import { SOCIAL_PLATFORMS, type SocialPlatform } from './socialPlatforms';

function socialPlatform(block: PageBlock): SocialPlatform | null {
  const platform = block.type === 'social-button' ? block.content.platform : null;
  return typeof platform === 'string' && SOCIAL_PLATFORMS.includes(platform as SocialPlatform) ? platform as SocialPlatform : null;
}

function containsSocialPlatform(document: PublicPageDocument, platform: SocialPlatform, exceptBlockId?: string): boolean {
  return document.sections.some((section) => section.blocks.some((block) => block.id !== exceptBlockId && socialPlatform(block) === platform));
}

function cloneDocument(document: PublicPageDocument): PublicPageDocument {
  return structuredClone(document);
}

function applyBlockMediaChanges(
  document: PublicPageDocument,
  changes: Extract<EditorAction, { type: 'block/add' }>['mediaChanges'],
): PublicPageDocument {
  if (!changes) {return document;}
  const upsertIds = new Set(changes.upsert.map((media) => media.id));
  const withUpserts = {
    ...document,
    media: [
      ...document.media.filter((media) => !upsertIds.has(media.id)),
      ...structuredClone(changes.upsert),
    ],
  };
  const removeIds = new Set(changes.removeIds);
  return {
    ...withUpserts,
    media: withUpserts.media.filter((media) => !removeIds.has(media.id) || documentReferencesMedia(withUpserts, media.id)),
  };
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

function insertStandaloneAt(
  sections: PageSection[],
  section: PageSection,
  blocks: PageBlock[],
  index: number,
): { sections: PageSection[]; destinationId: string } {
  const insertionIndex = clampIndex(index, sections.length);
  if (section.design.variant !== 'off') {
    return {
      sections: insertAt(sections, { ...structuredClone(section), blocks: structuredClone(blocks) }, insertionIndex),
      destinationId: section.id,
    };
  }
  const next = sections[insertionIndex];
  if (next?.design.variant === 'off') {
    return {
      sections: updateSection(sections, next.id, (candidate) => ({
        ...candidate,
        blocks: [...structuredClone(blocks), ...candidate.blocks],
      })),
      destinationId: next.id,
    };
  }
  const previous = sections[insertionIndex - 1];
  if (previous?.design.variant === 'off') {
    return {
      sections: updateSection(sections, previous.id, (candidate) => ({
        ...candidate,
        blocks: [...candidate.blocks, ...structuredClone(blocks)],
      })),
      destinationId: previous.id,
    };
  }
  return {
    sections: insertAt(sections, { ...structuredClone(section), blocks: structuredClone(blocks) }, insertionIndex),
    destinationId: section.id,
  };
}

function removeBlockFromSource(
  sections: PageSection[],
  sectionId: string,
  blockId: string,
): PageSection[] {
  return sections.map((section) => section.id === sectionId
    ? { ...section, blocks: section.blocks.filter((block) => block.id !== blockId) }
    : section);
}

function removeBlockAndPruneSource(
  sections: PageSection[],
  sectionId: string,
  blockId: string,
): PageSection[] {
  return sections.flatMap((section) => {
    if (section.id !== sectionId) {return [section];}
    const blocks = section.blocks.filter((candidate) => candidate.id !== blockId);
    return blocks.length ? [{ ...section, blocks }] : [];
  });
}

function splitSectionId(sections: readonly PageSection[], destinationId: string, sourceId: string): string {
  const base = `${destinationId}:after:${sourceId}`;
  const ids = new Set(sections.map((section) => section.id));
  if (!ids.has(base)) {return base;}
  let suffix = 2;
  while (ids.has(`${base}:${suffix}`)) {suffix += 1;}
  return `${base}:${suffix}`;
}

function reconcileSelection(document: PublicPageDocument, selection: EditorState['selection']): EditorState['selection'] {
  if (selection.blockId) {
    const section = document.sections.find((candidate) => candidate.blocks.some((block) => block.id === selection.blockId));
    return section ? { sectionId: section.id, blockId: selection.blockId } : { sectionId: null, blockId: null };
  }
  return selection.sectionId && document.sections.some((section) => section.id === selection.sectionId)
    ? selection
    : { sectionId: null, blockId: null };
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

function projectBlockDrop(
  document: PublicPageDocument,
  block: PageBlock,
  sourceId: string | null,
  to: { type: 'section'; sectionId: string; index: number },
): PublicPageDocument | null {
  if (to.sectionId === sourceId) {
    const source = document.sections.find((section) => section.id === sourceId);
    if (!source) {return null;}
    const blocks = reorderById(source.blocks, block.id, to.index);
    if (blocks.every((candidate, index) => candidate.id === source.blocks[index]?.id)) {return document;}
    return {
      ...document,
      sections: updateSection(document.sections, source.id, (section) => ({ ...section, blocks })),
    };
  }

  const destination = document.sections.find((section) => section.id === to.sectionId);
  if (!destination) {return null;}
  const source = sourceId ? document.sections.find((section) => section.id === sourceId) : null;
  if (source
    && source.blocks.length === 1
    && source.design.variant !== 'off'
    && destination.design.variant === 'off') {
    const destinationBlockIndex = clampIndex(to.index, destination.blocks.length);
    const sectionsWithoutSource = document.sections.filter((section) => section.id !== source.id);
    const destinationSectionIndex = sectionsWithoutSource.findIndex((section) => section.id === destination.id);
    const replacement = destinationBlockIndex === 0
      ? [source, destination]
      : destinationBlockIndex === destination.blocks.length
        ? [destination, source]
        : [
          { ...destination, blocks: destination.blocks.slice(0, destinationBlockIndex) },
          source,
          {
            ...destination,
            id: splitSectionId(document.sections, destination.id, source.id),
            blocks: destination.blocks.slice(destinationBlockIndex),
          },
        ];
    const sections = [
      ...sectionsWithoutSource.slice(0, destinationSectionIndex),
      ...replacement,
      ...sectionsWithoutSource.slice(destinationSectionIndex + 1),
    ];
    return JSON.stringify(sections.map((section) => [section.id, section.blocks.map((candidate) => candidate.id)]))
      === JSON.stringify(document.sections.map((section) => [section.id, section.blocks.map((candidate) => candidate.id)]))
      ? document : { ...document, sections };
  }

  let sections = sourceId ? removeBlockAndPruneSource(document.sections, sourceId, block.id) : document.sections;
  sections = updateSection(sections, destination.id, (section) => ({
    ...section,
    blocks: insertAt(section.blocks, structuredClone(block), to.index),
  }));
  return JSON.stringify(sections.map((section) => [section.id, section.blocks.map((candidate) => candidate.id)]))
    === JSON.stringify(document.sections.map((section) => [section.id, section.blocks.map((candidate) => candidate.id)]))
    ? document : { ...document, sections };
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
    case 'media/add':
      return commit(state, {
        ...state.document,
        media: [...state.document.media.filter((item) => item.id !== action.media.id), action.media],
      });
    case 'media/remove':
      if (documentReferencesMedia(state.document, action.mediaId)) {return state;}
      return commit(state, {
        ...state.document,
        media: state.document.media.filter((item) => item.id !== action.mediaId),
      });
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
      if (socialPlatform(action.block) && containsSocialPlatform(state.document, socialPlatform(action.block)!)) {return state;}
      return commit(state, applyBlockMediaChanges({
        ...state.document,
        sections: updateSection(state.document.sections, action.sectionId, (section) => ({
          ...section,
          blocks: insertAt(section.blocks, structuredClone(action.block), action.index),
        })),
      }, action.mediaChanges));
    case 'block/create-with-section': {
      const platforms = action.section.blocks.map(socialPlatform).filter((platform): platform is SocialPlatform => platform !== null);
      if (new Set(platforms).size !== platforms.length || platforms.some((platform) => containsSocialPlatform(state.document, platform))) {return state;}
      const selectedIndex = action.afterSectionId
        ? state.document.sections.findIndex((section) => section.id === action.afterSectionId)
        : -1;
      const index = selectedIndex >= 0 ? selectedIndex + 1 : state.document.sections.length;
      const inserted = insertStandaloneAt(state.document.sections, action.section, action.section.blocks, index);
      const next = commit(state, applyBlockMediaChanges({
        ...state.document,
        sections: inserted.sections,
      }, action.mediaChanges));
      return {
        ...next,
        selection: { sectionId: inserted.destinationId, blockId: action.section.blocks[0]?.id ?? null },
      };
    }
    case 'block/update': {
      const current = state.document.sections.find((section) => section.id === action.sectionId)?.blocks.find((block) => block.id === action.blockId);
      if (!current) {return state;}
      const updated = { ...current, ...action.changes };
      const platform = socialPlatform(updated);
      if (platform && containsSocialPlatform(state.document, platform, current.id)) {return state;}
      return commit(state, {
        ...state.document,
        sections: updateBlock(state.document.sections, action.sectionId, action.blockId, (block) => ({
          ...block,
          ...action.changes,
        })),
      });
    }
    case 'block/design':
      return commit(state, {
        ...state.document,
        sections: updateBlock(state.document.sections, action.sectionId, action.blockId, (block) => ({
          ...block,
          design: { ...block.design, ...action.changes },
        })),
      });
    case 'block/remove':
      {
        const sections = removeBlockFromSource(state.document.sections, action.sectionId, action.blockId);
        const sourceStillExists = sections.some((section) => section.id === action.sectionId);
        return {
          ...commit(state, { ...state.document, sections }),
          selection: state.selection.blockId === action.blockId
            ? { sectionId: sourceStillExists ? action.sectionId : null, blockId: null }
            : state.selection,
        };
      }
    case 'block/move-or-detach': {
      const source = state.document.sections.find((section) => section.id === action.fromSectionId);
      if (!source || !source.blocks.some((block) => block.id === action.block.id)) {return state;}
      if (action.toSectionId === action.fromSectionId && !action.newSection) {
        const next = commit(state, {
          ...state.document,
          sections: updateSection(state.document.sections, action.fromSectionId, (section) => ({
            ...section,
            ...(action.sectionChanges ?? {}),
            blocks: section.blocks.map((block) => block.id === action.block.id ? structuredClone(action.block) : block),
          })),
        });
        return { ...next, selection: { sectionId: action.fromSectionId, blockId: action.block.id } };
      }
      if (!action.newSection && (!action.toSectionId
        || !state.document.sections.some((section) => section.id === action.toSectionId))) {return state;}
      let sections = removeBlockFromSource(state.document.sections, action.fromSectionId, action.block.id);
      let destinationId: string;
      if (action.newSection) {
        const sourceIndex = state.document.sections.findIndex((section) => section.id === action.fromSectionId);
        const inserted = insertStandaloneAt(sections, action.newSection, [action.block], sourceIndex + 1);
        sections = inserted.sections;
        destinationId = inserted.destinationId;
      } else if (action.toSectionId) {
        destinationId = action.toSectionId;
        sections = updateSection(sections, destinationId, (section) => ({
          ...section,
          ...(action.sectionChanges ?? {}),
          blocks: insertAt(section.blocks, structuredClone(action.block), action.index),
        }));
      } else {
        return state;
      }
      const next = commit(state, { ...state.document, sections });
      return { ...next, selection: { sectionId: destinationId, blockId: action.block.id } };
    }
    case 'block/reorder':
      return commit(state, {
        ...state.document,
        sections: updateSection(state.document.sections, action.sectionId, (section) => ({
          ...section,
          blocks: reorderById(section.blocks, action.blockId, action.toIndex),
        })),
      });
    case 'layout/drop': {
      if (action.item.type === 'section') {
        if (action.to.type !== 'main') {return state;}
        const sections = reorderById(state.document.sections, action.item.sectionId, action.to.index);
        if (sections.every((section, index) => section.id === state.document.sections[index]?.id)) {return state;}
        return commit(state, { ...state.document, sections });
      }
      if (action.to.type !== 'section') {return state;}
      const blockId = action.item.blockId;
      const source = state.document.sections.find((section) => section.blocks.some((block) => block.id === blockId));
      const block = source?.blocks.find((candidate) => candidate.id === blockId);
      if (!block || !source) {return state;}
      const document = projectBlockDrop(state.document, block, source.id, action.to);
      if (!document || document === state.document) {return state;}
      const next = commit(state, document);
      const destination = next.document.sections.find((section) => section.blocks.some((candidate) => candidate.id === block.id));
      return { ...next, selection: { sectionId: destination?.id ?? null, blockId: block.id } };
    }
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
      const document = cloneDocument(previous);
      return {
        ...state,
        document,
        selection: reconcileSelection(document, state.selection),
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
      const document = cloneDocument(next);
      return {
        ...state,
        document,
        selection: reconcileSelection(document, state.selection),
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
