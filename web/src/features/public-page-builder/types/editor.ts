import type { PublicPageDocument } from './publicPage';

export type EditorSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type EditorSelection = {
  sectionId: string | null;
  blockId: string | null;
};

export type EditorState = {
  document: PublicPageDocument;
  past: PublicPageDocument[];
  future: PublicPageDocument[];
  selection: EditorSelection;
  saveStatus: EditorSaveStatus;
  saveError: string | null;
  publishErrors: string[];
  dirty: boolean;
};

export const EDITOR_HISTORY_LIMIT = 50;
