import { describe, expect, it } from 'vitest';
import {
  UnsupportedDocumentVersionError,
  migrateDocument,
} from '../../src/features/public-page-builder/model/migrateDocument';
import { createEmptyPageSection, normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import { validateDocument } from '../../src/features/public-page-builder/model/validateDocument';
import {
  createEditorState,
  editorReducer,
} from '../../src/features/public-page-builder/model/editorReducer';
import { PUBLIC_PAGE_SCHEMA_VERSION } from '../../src/features/public-page-builder/types/publicPage';
import { getPublicPageTemplate, PUBLIC_PAGE_TEMPLATES } from '../../src/features/public-page-builder/templates';
import { canDeleteMediaFromDocuments, collectReferencedMediaIds, reconcilePendingMediaCleanup } from '../../src/features/public-page-builder/model/media';
import { validateSocialPlatforms } from '../../src/features/public-page-builder/model/socialPlatforms';
import { PUBLIC_PAGE_THEMES } from '../../src/features/public-page-builder/config/themes';
import { blockSurfaceRadius, sectionThemeRadius, themeRadius } from '../../src/components/public-page-blocks/BlockRenderer';

describe('public page theme choices', () => {
  it('exposes the fixed palette set and normalizes legacy rounding', () => {
    expect(PUBLIC_PAGE_THEMES).toHaveLength(10);
    expect(new Set(PUBLIC_PAGE_THEMES.map((theme) => theme.id)).size).toBe(10);
    const legacy = structuredClone(getPublicPageTemplate('beauty')!.createDocument('legacy-theme')) as unknown as Record<string, unknown>;
    delete (legacy.theme as Record<string, unknown>).roundingStyle;
    delete (legacy.theme as Record<string, unknown>).linkStylePreset;
    const normalizedLegacy = normalizeDocument(legacy);
    expect(normalizedLegacy.theme.roundingStyle).toBe('rounded');
    expect(normalizedLegacy.theme.linkStylePreset).toBeTruthy();
  });

  it('persists all eight link style presets as distinct valid states', () => {
    const presets = ['primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline', 'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong'] as const;
    const document = getPublicPageTemplate('beauty')!.createDocument('link-presets');
    const normalized = presets.map((preset) => normalizeDocument({ ...document, theme: { ...document.theme, linkStylePreset: preset } }).theme.linkStylePreset);
    expect(new Set(normalized)).toEqual(new Set(presets));
  });

  it('maps all four screenshot button shapes', () => {
    expect(themeRadius('rounded', 24)).toBe('24px');
    expect(themeRadius('pill', 24)).toBe('40px');
    expect(themeRadius('leaf', 24)).toBe('24px 4px 24px 4px');
    expect(themeRadius('square', 24)).toBe('2px');
  });

  it('keeps leaf asymmetry on links while sections use the symmetric maximum radius', () => {
    expect(themeRadius('leaf', 32)).toBe('32px 4px 32px 4px');
    expect(sectionThemeRadius('rounded', 32)).toBe('32px');
    expect(sectionThemeRadius('pill', 32)).toBe('40px');
    expect(sectionThemeRadius('leaf', 32)).toBe('32px');
    expect(sectionThemeRadius('square', 32)).toBe('2px');
    expect(blockSurfaceRadius(null, 'leaf', 32)).toBe('32px');
    expect(blockSurfaceRadius(11, 'leaf', 32)).toBe('11px');
  });
});

describe('public page document model', () => {
  it('adds a block and media atomically, then releases media after divergent undo', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('atomic-block-media');
    const before = structuredClone(document);
    const target = document.sections[document.sections.length - 1];
    const block = { ...structuredClone(target.blocks[0]), id: 'atomic-media-block' };
    const media = { id: 'atomic-upload', url: 'https://example.com/atomic.png', mimeType: 'image/png' as const, alt: 'Atomic', width: 20, height: 20 };
    block.design.backgroundMediaId = media.id;

    const added = editorReducer(createEditorState(document), {
      type: 'block/add', sectionId: target.id, block, index: target.blocks.length,
      mediaChanges: { upsert: [media], removeIds: [] },
    });
    expect(added.past).toHaveLength(1);
    expect(added.document.media).toContainEqual(media);
    expect(added.document.sections.at(-1)?.blocks.at(-1)?.id).toBe(block.id);

    const undone = editorReducer(added, { type: 'history/undo' });
    expect(undone.document).toEqual(before);
    expect(canDeleteMediaFromDocuments([undone.document, ...undone.past, ...undone.future], media.id)).toBe(false);

    const diverged = editorReducer(undone, { type: 'slug/update', slug: 'atomic-diverged' });
    expect(diverged.future).toHaveLength(0);
    expect(canDeleteMediaFromDocuments([diverged.document, ...diverged.past, ...diverged.future], media.id)).toBe(true);
  });

  it('creates the first off section with its media in one history entry', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('atomic-empty-page');
    document.sections = [];
    const before = structuredClone(document);
    const block = structuredClone(getPublicPageTemplate('beauty')!.createDocument('atomic-first-block').sections[0].blocks[0]);
    const media = { id: 'atomic-first-upload', url: 'https://example.com/first.png', mimeType: 'image/png' as const, alt: 'First', width: 20, height: 20 };
    block.id = 'atomic-first-block';
    block.design.backgroundMediaId = media.id;
    const section = createEmptyPageSection('off');
    section.blocks = [block];

    const added = editorReducer(createEditorState(document), {
      type: 'block/create-with-section', section, mediaChanges: { upsert: [media], removeIds: [] },
    });
    expect(added.past).toHaveLength(1);
    expect(added.document.sections).toHaveLength(1);
    expect(added.document.sections[0]).toMatchObject({ design: { variant: 'off' }, blocks: [{ id: block.id }] });
    expect(added.document.media).toContainEqual(media);
    expect(editorReducer(added, { type: 'history/undo' }).document).toEqual(before);
  });

  it('keeps section ids unique when normalizing a legacy multi-block off group', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('legacy-off-group');
    const [off, decorated] = document.sections;
    off.design.variant = 'off';
    off.blocks.push({ ...structuredClone(off.blocks[0]), id: 'second-free-block' });
    decorated.design.variant = 'primary';
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'section', sectionId: decorated.id }, to: { type: 'main', index: 0 },
    });

    expect(new Set(moved.document.sections.map((section) => section.id)).size).toBe(moved.document.sections.length);
    expect(moved.document.sections.flatMap((section) => section.blocks).map((block) => block.id))
      .toEqual([decorated.blocks[0].id, off.blocks[0].id, 'second-free-block']);
  });

  it('prunes an ordinary source section when its last block moves out', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('pruned-source');
    const [source, destination] = document.sections;
    source.design.variant = 'primary'; destination.design.variant = 'secondary';
    const block = source.blocks[0];
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: block.id }, to: { type: 'section', sectionId: destination.id, index: 0 },
    });

    expect(moved.document.sections.some((section) => section.id === source.id)).toBe(false);
    expect(moved.document.sections[0].blocks[0].id).toBe(block.id);
    expect(moved.past).toHaveLength(1);
    expect(editorReducer(moved, { type: 'history/undo' }).document).toEqual(document);
  });

  it('moves a styled last-block section to the start of an off destination', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('styled-start');
    const [source, destination] = document.sections;
    source.design.variant = 'primary'; destination.design.variant = 'off';
    destination.blocks.push({ ...structuredClone(destination.blocks[0]), id: 'start-free-sibling' });
    document.sections = [destination, source];
    const sourceSnapshot = structuredClone(source);
    const destinationSnapshot = structuredClone(destination);
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: source.blocks[0].id },
      to: { type: 'section', sectionId: destination.id, index: 0 },
    });

    expect(moved.document.sections.map((section) => section.id)).toEqual([source.id, destination.id]);
    expect(moved.document.sections[0]).toEqual(sourceSnapshot);
    expect(moved.document.sections[1]).toEqual(destinationSnapshot);
  });

  it('moves a styled last-block section to the end of an off destination', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('styled-end');
    const [source, destination] = document.sections;
    source.design.variant = 'secondary'; destination.design.variant = 'off';
    destination.blocks.push({ ...structuredClone(destination.blocks[0]), id: 'end-free-sibling' });
    const sourceSnapshot = structuredClone(source);
    const destinationSnapshot = structuredClone(destination);
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: source.blocks[0].id },
      to: { type: 'section', sectionId: destination.id, index: destination.blocks.length },
    });

    expect(moved.document.sections.map((section) => section.id)).toEqual([destination.id, source.id]);
    expect(moved.document.sections[0]).toEqual(destinationSnapshot);
    expect(moved.document.sections[1]).toEqual(sourceSnapshot);
  });

  it('splits an off destination around a styled last-block section and undoes atomically', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('styled-internal');
    const [source, destination] = document.sections;
    source.design.variant = 'custom'; destination.design.variant = 'off';
    destination.blocks.push({ ...structuredClone(destination.blocks[0]), id: 'internal-free-sibling' });
    const sourceSnapshot = structuredClone(source);
    const [beforeBlock, afterBlock] = destination.blocks;
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: source.blocks[0].id },
      to: { type: 'section', sectionId: destination.id, index: 1 },
    });

    expect(moved.document.sections.map((section) => section.id)).toEqual([
      destination.id,
      source.id,
      `${destination.id}:after:${source.id}`,
    ]);
    expect(moved.document.sections[0].blocks).toEqual([beforeBlock]);
    expect(moved.document.sections[1]).toEqual(sourceSnapshot);
    expect(moved.document.sections[2]).toMatchObject({
      design: { variant: 'off' },
      blocks: [{ id: afterBlock.id }],
    });
    expect(moved.past).toHaveLength(1);
    expect(editorReducer(moved, { type: 'history/undo' }).document).toEqual(document);
  });

  it('moves blocks between transparent and decorated sections in one undo step', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('section-layout');
    const [source, destination] = document.sections;
    source.design.variant = 'off'; destination.design.variant = 'primary';
    const block = source.blocks[0];
    const sibling = { ...structuredClone(block), id: 'transparent-sibling' };
    source.blocks.push(sibling);
    const initial = createEditorState(document);
    const entered = editorReducer(initial, { type: 'layout/drop', item: { type: 'block', blockId: block.id },
      to: { type: 'section', sectionId: destination.id, index: 0 } });
    expect(entered.document.sections.find((section) => section.id === source.id)?.blocks).toEqual([sibling]);
    expect(entered.document.sections.find((section) => section.id === destination.id)?.blocks[0].id).toBe(block.id);
    expect(entered.past).toHaveLength(1);
    expect(editorReducer(entered, { type: 'history/undo' }).document).toEqual(document);

    const exited = editorReducer(entered, { type: 'layout/drop', item: { type: 'block', blockId: block.id },
      to: { type: 'section', sectionId: source.id, index: 0 } });
    expect(exited.document.sections[0]).toMatchObject({ id: source.id, design: { variant: 'off' } });
    expect(exited.document.sections[0].blocks[0]).toEqual(block);
    expect(exited.past).toHaveLength(2);
  });

  it('commits section-to-section, same-section, and section drops atomically', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('linear-cases');
    const [first, second] = document.sections;
    first.design.variant = 'primary'; second.design.variant = 'secondary';
    const movedBlock = first.blocks[0];
    const sibling = { ...structuredClone(movedBlock), id: 'linear-sibling' };
    first.blocks.push(sibling);
    const cross = editorReducer(createEditorState(document), { type: 'layout/drop', item: { type: 'block', blockId: movedBlock.id },
      to: { type: 'section', sectionId: second.id, index: 1 } });
    expect(cross.document.sections.find((section) => section.id === first.id)?.blocks.map((block) => block.id)).toEqual([sibling.id]);
    expect(cross.document.sections.find((section) => section.id === second.id)?.blocks[1].id).toBe(movedBlock.id);
    expect(cross.past).toHaveLength(1);
    expect(editorReducer(cross, { type: 'history/undo' }).document).toEqual(document);

    const same = editorReducer(createEditorState(document), { type: 'layout/drop', item: { type: 'block', blockId: sibling.id },
      to: { type: 'section', sectionId: first.id, index: 0 } });
    expect(same.document.sections[0].blocks.map((block) => block.id)).toEqual([sibling.id, movedBlock.id]);
    const unchanged = editorReducer(createEditorState(document), { type: 'layout/drop', item: { type: 'block', blockId: movedBlock.id },
      to: { type: 'section', sectionId: first.id, index: 0 } });
    expect(unchanged.past).toHaveLength(0);

    const sectionDrop = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'section', sectionId: second.id }, to: { type: 'main', index: 0 },
    });
    expect(sectionDrop.document.sections[0].id).toBe(second.id);
  });


  it('validates individual social buttons and destructively drops retired social blocks', () => {
    expect(validateSocialPlatforms({ platform: 'instagram' })).toEqual([]);
    expect(validateSocialPlatforms({ platform: 'myspace' })).toContain('platform is invalid');
    const document = getPublicPageTemplate('beauty')!.createDocument('social-normalization');
    document.sections[0].blocks.push({ ...document.sections[0].blocks[0], id: 'legacy', type: 'socials' });
    document.sections[0].blocks.push({ ...document.sections[0].blocks[0], id: 'invalid', type: 'social-button', content: { platform: 'youtube', label: 'YouTube', url: 'https://youtube.com' } });
    document.sections[0].blocks.push({ ...document.sections[0].blocks[0], id: 'valid', type: 'social-button', content: { platform: 'vk', label: 'VK', url: 'https://vk.com' } });
    expect(normalizeDocument(document).sections[0].blocks.map((block) => block.id)).toContain('valid');
    expect(normalizeDocument(document).sections[0].blocks.map((block) => block.id)).not.toEqual(expect.arrayContaining(['legacy', 'invalid']));
  });

  it('keeps save blocked through double cleanup failure and excludes the orphan after a successful replace retry', () => {
    const oldUpload = { media: { id: 'old-upload' } };
    const rollbackUpload = { media: { id: 'rollback-upload' } };
    const retryUpload = { media: { id: 'retry-upload' } };

    const oldCleanup = reconcilePendingMediaCleanup(
      [oldUpload, rollbackUpload], new Set(), new Set(['old-upload']), new Set(['old-upload']),
    );
    const rollbackCleanup = reconcilePendingMediaCleanup(
      oldCleanup.pending, oldCleanup.failedIds, new Set(['rollback-upload']), new Set(['rollback-upload']),
    );
    expect([...rollbackCleanup.failedIds]).toEqual(['old-upload', 'rollback-upload']);
    expect(rollbackCleanup.pending).toEqual([oldUpload, rollbackUpload]);

    const retryCleanup = reconcilePendingMediaCleanup(
      [...rollbackCleanup.pending, retryUpload], rollbackCleanup.failedIds,
      new Set(['old-upload', 'rollback-upload']), new Set(),
    );
    expect(retryCleanup.failedIds.size).toBe(0);
    expect(retryCleanup.pending.map((item) => item.media.id)).toEqual(['retry-upload']);
  });

  it('retains detached media while undo or redo history can restore a reference', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('media-history');
    const block = document.sections[0].blocks[0];
    block.design.backgroundMediaId = 'media-history-id';
    let state = createEditorState(document);
    state = editorReducer(state, { type: 'block/design', sectionId: document.sections[0].id, blockId: block.id, changes: { backgroundMediaId: null } });
    expect(canDeleteMediaFromDocuments([state.document, ...state.past, ...state.future], 'media-history-id')).toBe(false);
    state = editorReducer(state, { type: 'history/undo' });
    expect(state.document.sections[0].blocks[0].design.backgroundMediaId).toBe('media-history-id');
    expect(canDeleteMediaFromDocuments([state.document, ...state.past, ...state.future], 'media-history-id')).toBe(false);
  });
  it('creates every non-blank template as a visible ready page with a local hero placeholder', () => {
    for (const template of PUBLIC_PAGE_TEMPLATES.filter(({ id }) => id !== 'blank')) {
      const document = template.createDocument(`test-${template.id}`, '2026-01-01T00:00:00.000Z');
      const visibleBlocks = document.sections
        .filter((section) => section.visible)
        .flatMap((section) => section.blocks.filter((pageBlock) => pageBlock.visible));
      const intro = visibleBlocks.find((pageBlock) => pageBlock.type === 'hero' || pageBlock.type === 'avatar');

      expect(visibleBlocks.length, template.id).toBeGreaterThan(1);
      expect(intro?.content.title ?? intro?.content.heading, template.id).toEqual(expect.any(String));
      expect(intro?.content.subtitle, template.id).toEqual(expect.any(String));
      expect(intro?.content.imageUrl, template.id).toBe(`/public-page-placeholders/${template.id}.svg`);
      expect(document.media, template.id).toEqual([]);
      expect(document.sections.every((section) => section.blocks.length === 1), template.id).toBe(true);
    }
  });

  it('creates the selected non-blank template document instead of a blank page', () => {
    const document = getPublicPageTemplate('beauty')?.createDocument('selected-template');
    expect(document?.sections.flatMap((section) => section.blocks).length).toBeGreaterThan(0);
  });

  it('adds safe section design defaults without nesting blocks', () => {
    const document = normalizeDocument({ sections: [{ id: 'section', blocks: [{ id: 'text', type: 'text', content: {} }] }] });
    expect(document.sections[0].design).toEqual({
      variant: 'custom', backgroundColor: null, textColor: null, backgroundMediaId: null, backgroundOverlay: 0,
      backgroundFit: 'cover', backgroundPosition: '50% 50%', paddingTop: 0, paddingBottom: 0,
      horizontalMargin: false, borderRadius: null, borderWidth: 0, borderColor: null, shadow: false, width: 'full', mobileVisible: true,
      headingStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      textStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      linkStyle: { titleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
        subtitleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
        backgroundColor: null, backgroundOpacity: null, borderWidth: null, borderColor: null, shadow: null },
    });
    expect(document.sections[0].blocks).toHaveLength(1);
  });

  it('collects unique media references before a section is removed', () => {
    expect(collectReferencedMediaIds({
      design: { backgroundMediaId: 'section-bg' },
      blocks: [
        { design: { backgroundMediaId: 'block-bg' }, content: { imageMediaId: 'avatar', coverMediaId: 'cover' } },
        { content: { images: [{ mediaId: 'avatar' }, { mediaId: 'gallery' }] } },
      ],
    })).toEqual(['section-bg', 'block-bg', 'avatar', 'cover', 'gallery']);
  });

  it('normalizes styling inheritance and preserves explicit zero overrides', () => {
    const document = normalizeDocument({ theme: { colors: { text: '#123456', primary: '#abcdef', surface: '#ffffff' } }, sections: [{
      blocks: [{ type: 'text', design: { borderRadius: 0 } }],
      design: { borderRadius: 0, headingStyle: { fontSize: 200, fontWeight: 350 }, linkStyle: { backgroundOpacity: 0, borderWidth: 20 } },
    }] });
    expect(document.theme.styleDefaults).toMatchObject({ sectionBorderRadius: 40, blockBorderRadius: 40,
      headingStyle: { color: '#123456' }, linkStyle: { titleStyle: { color: '#abcdef' } } });
    expect(document.sections[0].design).toMatchObject({ borderRadius: 0, headingStyle: { fontSize: 96, fontWeight: 350 },
      linkStyle: { backgroundOpacity: 0, borderWidth: 16 } });
    expect(document.sections[0].blocks[0].design.borderRadius).toBe(0);
    expect(validateDocument(document).valid).toBe(true);
  });

  it('uses avatar blocks in new templates and preserves legacy profile compatibility', () => {
    for (const template of PUBLIC_PAGE_TEMPLATES.filter(({ id }) => id !== 'blank')) {
      const document = template.createDocument(`avatar-${template.id}`);
      expect(document.sections.flatMap((section) => section.blocks).some((block) => block.type === 'hero')).toBe(false);
      expect(document.sections.flatMap((section) => section.blocks).some((block) => block.type === 'avatar')).toBe(true);
      expect(document.profile.displayName).toBe('');
    }
    expect(normalizeDocument({ profile: { displayName: 'Legacy profile' } }).profile.displayName).toBe('Legacy profile');
  });

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

  it('creates a block section after the selection and undoes it in one step', () => {
    const document = getPublicPageTemplate('specialist')!.createDocument('move-block');
    const block = structuredClone(document.sections[0].blocks[0]);
    block.id = 'created-block';
    const section = { ...structuredClone(document.sections[0]), id: 'created-section', name: 'Section 9', blocks: [block] };
    const created = editorReducer(createEditorState(document), {
      type: 'block/create-with-section', section, afterSectionId: document.sections[1].id,
    });

    expect(created.document.sections[2].id).toBe('created-section');
    expect(created.selection).toEqual({ sectionId: 'created-section', blockId: 'created-block' });
    expect(created.past).toHaveLength(1);
    const undone = editorReducer(created, { type: 'history/undo' });
    expect(undone.document.sections).toHaveLength(document.sections.length);
    expect(undone.selection).toEqual({ sectionId: null, blockId: null });
  });

  it('appends a created block section when there is no valid selection', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('append-block');
    const block = structuredClone(document.sections[0].blocks[0]);
    block.id = 'appended-block';
    const section = { ...structuredClone(document.sections[0]), id: 'appended-section', blocks: [block] };
    const created = editorReducer(createEditorState(document), {
      type: 'block/create-with-section', section, afterSectionId: 'missing-section',
    });
    expect(created.document.sections.at(-1)?.id).toBe('appended-section');
  });

  it('reuses the immediately next off group when creating a standalone block', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('reuse-next-off');
    const [selected, nextOff] = document.sections;
    nextOff.design.variant = 'off';
    const block = structuredClone(selected.blocks[0]);
    block.id = 'created-standalone';
    const section = { ...structuredClone(selected), id: 'unused-off-section', design: { ...structuredClone(selected.design), variant: 'off' as const }, blocks: [block] };

    const created = editorReducer(createEditorState(document), {
      type: 'block/create-with-section', section, afterSectionId: selected.id,
    });

    expect(created.document.sections).toHaveLength(document.sections.length);
    expect(created.document.sections[1].blocks.map((candidate) => candidate.id)).toEqual([block.id, nextOff.blocks[0].id]);
    expect(created.selection).toEqual({ sectionId: nextOff.id, blockId: block.id });
    expect(created.past).toHaveLength(1);
  });

  it('moves a block, appends it, and retains its empty source in one undoable change', () => {
    const document = getPublicPageTemplate('specialist')!.createDocument('move-block');
    const source = document.sections[0];
    const destination = document.sections[1];
    const block = source.blocks[0];

    const moved = editorReducer(createEditorState(document), {
      type: 'block/move-or-detach', fromSectionId: source.id, toSectionId: destination.id, block,
    });
    expect(moved.document.sections.find((section) => section.id === source.id)?.blocks).toEqual([]);
    expect(moved.document.sections.find((section) => section.id === destination.id)?.blocks.at(-1)?.id).toBe(block.id);
    expect(moved.past).toHaveLength(1);

    const undone = editorReducer(moved, { type: 'history/undo' });
    expect(undone.document.sections.find((section) => section.id === source.id)?.blocks[0].id).toBe(block.id);
    expect(undone.document).toEqual(document);
    expect(undone.selection).toEqual({ sectionId: source.id, blockId: block.id });
  });

  it('detaches a block into a new section immediately after its source', () => {
    const document = getPublicPageTemplate('specialist')!.createDocument('detach-block');
    const source = document.sections[0];
    const block = source.blocks[0];
    const detachedSection = { ...structuredClone(source), id: 'detached', name: 'Section 7', blocks: [block] };
    const detached = editorReducer(createEditorState(document), {
      type: 'block/move-or-detach', fromSectionId: source.id, block, newSection: detachedSection,
    });

    expect(detached.document.sections[1].id).toBe('detached');
    expect(detached.document.sections[0].blocks).toHaveLength(0);
    expect(detached.selection).toEqual({ sectionId: 'detached', blockId: block.id });
    const undone = editorReducer(detached, { type: 'history/undo' });
    expect(undone.document).toEqual(document);
    expect(undone.selection).toEqual({ sectionId: source.id, blockId: block.id });
  });

  it('retains a section when its last block is deleted', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('delete-block');
    const source = document.sections[0];
    const removed = editorReducer(createEditorState(document), {
      type: 'block/remove', sectionId: source.id, blockId: source.blocks[0].id,
    });

    expect(removed.document.sections.find((section) => section.id === source.id)?.blocks).toEqual([]);
    expect(removed.past).toHaveLength(1);
    expect(editorReducer(removed, { type: 'history/undo' }).document).toEqual(document);
  });

  it('preserves unrelated legacy empty sections and ignores a stale move destination', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('legacy-empty');
    const source = document.sections[0];
    const block = source.blocks[0];
    document.sections.push({ ...structuredClone(source), id: 'legacy-empty-section', blocks: [] });

    const staleMove = editorReducer(createEditorState(document), {
      type: 'block/move-or-detach', fromSectionId: source.id, toSectionId: 'missing', block,
    });
    expect(staleMove.document).toEqual(document);
    expect(staleMove.past).toHaveLength(0);

    const removed = editorReducer(createEditorState(document), {
      type: 'block/remove', sectionId: source.id, blockId: block.id,
    });
    expect(removed.document.sections.some((section) => section.id === 'legacy-empty-section')).toBe(true);
  });

  it('uses section drop boundaries when reordering downward', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('section-drop-down');
    document.sections.push({ ...structuredClone(document.sections[0]), id: 'third-section' });
    const [first, second, third] = document.sections;
    const moved = editorReducer(createEditorState(document), {
      type: 'section/reorder', sectionId: first.id, toIndex: 2,
    });
    expect(moved.document.sections.slice(0, 3).map((section) => section.id)).toEqual([second.id, third.id, first.id]);
  });

  it('moves a section to the immediately next final index from toolbar actions', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('section-toolbar-down');
    const [first, second] = document.sections;
    const moved = editorReducer(createEditorState(document), {
      type: 'section/reorder', sectionId: first.id, toIndex: 1,
    });
    expect(moved.document.sections.slice(0, 2).map((section) => section.id)).toEqual([second.id, first.id]);
  });

  it('removes media only after its final document reference is detached', () => {
    const initial = normalizeDocument({
      id: 'page-1',
      media: [{ id: 'shared-image', url: 'https://example.com/image.png', mimeType: 'image/png', alt: 'Portrait', width: 100, height: 100 }],
      profile: { logoMediaId: 'shared-image', avatarMediaId: 'shared-image' },
    });
    const referenced = editorReducer(createEditorState(initial), { type: 'media/remove', mediaId: 'shared-image' });
    expect(referenced.document.media).toHaveLength(1);

    const withoutLogo = editorReducer(referenced, { type: 'profile/update', changes: { logoMediaId: null } });
    const stillShared = editorReducer(withoutLogo, { type: 'media/remove', mediaId: 'shared-image' });
    expect(stillShared.document.media).toHaveLength(1);

    const withoutAvatar = editorReducer(stillShared, { type: 'profile/update', changes: { avatarMediaId: null } });
    const removed = editorReducer(withoutAvatar, { type: 'media/remove', mediaId: 'shared-image' });
    expect(removed.document.media).toHaveLength(0);
  });
});
