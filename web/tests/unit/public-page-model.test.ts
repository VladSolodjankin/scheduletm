import { describe, expect, it } from 'vitest';
import {
  UnsupportedDocumentVersionError,
  migrateDocument,
} from '../../src/features/public-page-builder/model/migrateDocument';
import { normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import {
  createEditorState,
  editorReducer,
} from '../../src/features/public-page-builder/model/editorReducer';
import { PUBLIC_PAGE_SCHEMA_VERSION } from '../../src/features/public-page-builder/types/publicPage';

describe('public page document model', () => {
  it('normalizes damaged input into a safe current document', () => {
    const document = normalizeDocument({
      schemaVersion: -1,
      slug: '  My-PAGE  ',
      status: 'unknown',
      profile: null,
      sections: [
        null,
        {
          id: 'section-1',
          layout: 'unsupported',
          blocks: [{ id: 'block-1', type: 'text', visible: 'yes', content: null }],
        },
      ],
      media: [{ id: 'bad' }, { id: 'image-1', url: 'https://example.com/image.png', mimeType: 'bad' }],
    });

    expect(document.schemaVersion).toBe(PUBLIC_PAGE_SCHEMA_VERSION);
    expect(document.slug).toBe('my-page');
    expect(document.status).toBe('draft');
    expect(document.sections).toHaveLength(1);
    expect(document.sections[0]?.layout).toBe('single');
    expect(document.sections[0]?.blocks[0]).toMatchObject({
      id: 'block-1',
      type: 'text',
      visible: true,
      content: {},
    });
    expect(document.media).toHaveLength(1);
    expect(document.media[0]?.mimeType).toBe('image/jpeg');
  });

  it('rejects documents created by a newer unsupported schema', () => {
    expect(() => migrateDocument({ schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION + 1 }))
      .toThrow(UnsupportedDocumentVersionError);
  });

  it('undoes and redoes committed editor changes', () => {
    const initial = normalizeDocument({ id: 'page-1', slug: 'initial' });
    const changed = editorReducer(createEditorState(initial), {
      type: 'slug/update',
      slug: 'Changed Slug',
    });
    const undone = editorReducer(changed, { type: 'history/undo' });
    const redone = editorReducer(undone, { type: 'history/redo' });

    expect(changed.document.slug).toBe('changed slug');
    expect(undone.document.slug).toBe('initial');
    expect(redone.document.slug).toBe('changed slug');
  });
});
