import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyPageSection, normalizeDocument, normalizeRichTextDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import { validateDocument } from '../../src/features/public-page-builder/model/validateDocument';
import {
  createEditorState,
  editorReducer,
} from '../../src/features/public-page-builder/model/editorReducer';
import { PUBLIC_PAGE_SCHEMA_VERSION, type PublicPageDocument } from '../../src/features/public-page-builder/types/publicPage';
import { getPublicPageTemplate, PUBLIC_PAGE_TEMPLATES } from '../../src/features/public-page-builder/templates';
import { canDeleteMediaFromDocuments, collectReferencedMediaIds, reconcilePendingMediaCleanup } from '../../src/features/public-page-builder/model/media';
import { validateSocialPlatforms } from '../../src/features/public-page-builder/model/socialPlatforms';
import { applyPublicPageThemeRounding, PUBLIC_PAGE_THEMES } from '../../src/features/public-page-builder/config/themes';
import { blockSurfaceRadius, sectionThemeRadius } from '../../src/components/public-page-blocks/BlockRenderer';
import { isServiceSelectable, normalizeServicesContent, validateServicesBlockContent } from '../../src/features/public-page-builder/model/services';
import { isPublishValidationResultCurrent, resolvePublishIssueFocusTarget, validateForPublish } from '../../src/features/public-page-builder/model/publishValidation';
import { validateSlug } from '../../src/features/public-page-builder/model/slug';
import {
  reduceEditorActionForMutationTracking,
  usePublicPageEditor,
} from '../../src/features/public-page-builder/hooks/usePublicPageEditor';
import type { PublicPageRepository } from '../../src/features/public-page-builder/repository/PublicPageRepository';
import { getBlockDefinition, registerBlock } from '../../src/features/public-page-builder/model/blockRegistry';
import {
  PUBLIC_PAGE_ORIGIN,
  publicPageDisplayUrl,
  publicPageUrl,
  resolvePublicPageOrigin,
} from '../../src/features/public-page-builder/config/publicPageUrl';

function capturePublicPageEditor(
  document: PublicPageDocument,
  repository: PublicPageRepository,
) {
  let captured: ReturnType<typeof usePublicPageEditor> | undefined;
  function Harness() {
    captured = usePublicPageEditor({ document, revision: 1, repository });
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  if (!captured) {throw new Error('editor hook was not captured');}
  return captured;
}

function createPublicPageRepositoryMock(
  overrides: Partial<PublicPageRepository> = {},
): PublicPageRepository {
  const unused = async () => {throw new Error('unexpected repository call');};
  return {
    list: unused,
    checkSlugAvailability: async (slug) => ({ slug, available: true }),
    get: unused,
    create: unused,
    saveDraft: unused,
    archive: unused,
    restore: unused,
    delete: unused,
    publish: unused,
    getBySlug: unused,
    ...overrides,
  } as PublicPageRepository;
}

function setNestedValue(target: unknown, path: string, value: unknown): void {
  const segments = path.split('.');
  let current = target as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1)!] = value;
}

describe('public page theme choices', () => {
  it('exposes the fixed palette set and defaults missing theme controls', () => {
    expect(PUBLIC_PAGE_THEMES).toHaveLength(10);
    expect(new Set(PUBLIC_PAGE_THEMES.map((theme) => theme.id)).size).toBe(10);
    const incomplete = structuredClone(getPublicPageTemplate('beauty')!.createDocument('incomplete-theme')) as unknown as Record<string, unknown>;
    delete (incomplete.theme as Record<string, unknown>).roundingStyle;
    delete (incomplete.theme as Record<string, unknown>).linkStylePreset;
    const normalized = normalizeDocument(incomplete);
    expect(normalized.theme.roundingStyle).toBe('rounded');
    expect(normalized.theme.linkStylePreset).toBeTruthy();
  });

  it.each([
    'theme.swatches.0',
    'theme.swatches.1',
    'theme.swatches.2',
    'theme.swatches.3',
    'theme.fontFamily',
    ...['contrast', 'linkTitle', 'linkSubtitle', 'linkShadow', 'linkBorder', 'focus', 'checkboxBackground']
      .map((field) => `theme.tokens.colors.${field}`),
    'theme.tokens.typography.fontFamily',
    'theme.tokens.typography.headingColor',
    ...['avatarTitle', 'avatarBio', 'linkTitle', 'linkSubtitle', 'h1', 'h2', 'h3', 'textLarge', 'textMedium', 'textSmall']
      .map((token) => `theme.tokens.typography.${token}.fontFamily`),
    'theme.styleDefaults.headingStyle.fontFamily',
    'theme.styleDefaults.headingStyle.color',
    'theme.styleDefaults.textStyle.fontFamily',
    'theme.styleDefaults.textStyle.color',
    'theme.styleDefaults.linkStyle.titleStyle.fontFamily',
    'theme.styleDefaults.linkStyle.titleStyle.color',
    'theme.styleDefaults.linkStyle.subtitleStyle.fontFamily',
    'theme.styleDefaults.linkStyle.subtitleStyle.color',
    'theme.styleDefaults.linkStyle.backgroundColor',
    'theme.styleDefaults.linkStyle.borderColor',
  ])('rejects a blank required theme string at %s', (path) => {
    const document = structuredClone(getPublicPageTemplate('beauty')!.createDocument('blank-theme-value'));
    setNestedValue(document, path, '');

    expect(validateDocument(document).errors).toContainEqual(expect.objectContaining({ path }));
  });

  it('accepts nullable theme media and section style overrides', () => {
    const document = structuredClone(getPublicPageTemplate('beauty')!.createDocument('nullable-theme-overrides'));
    document.theme.backgroundMediaId = null;
    document.theme.backgroundPreset = null;
    document.sections[0].design.headingStyle = {
      fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null,
    };
    document.sections[0].design.textStyle = {
      fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null,
    };
    document.sections[0].design.linkStyle = {
      titleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      subtitleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      backgroundColor: null,
      backgroundOpacity: null,
      borderWidth: null,
      borderColor: null,
      shadow: null,
    };

    expect(validateDocument(document)).toMatchObject({ valid: true, errors: [] });
  });

  it('persists all eight link style presets as distinct valid states', () => {
    const presets = ['primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline', 'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong'] as const;
    const document = getPublicPageTemplate('beauty')!.createDocument('link-presets');
    const normalized = presets.map((preset) => normalizeDocument({ ...document, theme: { ...document.theme, linkStylePreset: preset } }).theme.linkStylePreset);
    expect(new Set(normalized)).toEqual(new Set(presets));
  });

  it('keeps section and block surfaces symmetric across rounding styles', () => {
    expect(sectionThemeRadius('rounded', 32)).toBe('32px');
    expect(sectionThemeRadius('pill', 32)).toBe('32px');
    expect(sectionThemeRadius('leaf', 32)).toBe('32px');
    expect(sectionThemeRadius('square', 32)).toBe('32px');
    expect(blockSurfaceRadius(null, 'leaf', 32)).toBe('32px');
    expect(blockSurfaceRadius(11, 'leaf', 32)).toBe('11px');
  });

  it.each([['pill', 40], ['square', 2]] as const)('materializes %s preset radius in canonical defaults', (preset, radius) => {
    const theme = applyPublicPageThemeRounding(PUBLIC_PAGE_THEMES[0], preset);
    expect(theme.styleDefaults.sectionBorderRadius).toBe(radius);
    expect(theme.styleDefaults.blockBorderRadius).toBe(radius);
    expect(theme.tokens.layout.linkRadius).toBe(radius);
  });
});

describe('public page slug model', () => {
  it('reserves the public booking route', () => {
    expect(validateSlug('booking')).toBe('reserved');
    expect(validateSlug('Booking')).toBe('reserved');
  });

});

describe('public page URL configuration', () => {
  it('normalizes supported origins and allows plain HTTP only for loopback hosts', () => {
    expect(resolvePublicPageOrigin('  https://pages.example.com/  ')).toBe('https://pages.example.com');
    expect(resolvePublicPageOrigin('http://localhost:5173/')).toBe('http://localhost:5173');
    expect(resolvePublicPageOrigin('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173');
    expect(resolvePublicPageOrigin('http://[::1]:5173/')).toBe('http://[::1]:5173');
    expect(resolvePublicPageOrigin('http://pages.example.com')).toBe('https://meetli.cc');
  });

  it('rejects unsafe or non-origin values and falls back to the production origin', () => {
    for (const value of [
      '',
      'not a url',
      'https://user:pass@pages.example.com',
      'https://pages.example.com/public',
      'https://pages.example.com/?campaign=test',
      'https://pages.example.com/#preview',
    ]) {
      expect(resolvePublicPageOrigin(value)).toBe('https://meetli.cc');
    }
  });

  it('builds encoded absolute and display URLs without reading browser globals', () => {
    expect(publicPageUrl('hello world')).toBe(`${PUBLIC_PAGE_ORIGIN}/hello%20world`);
    expect(publicPageDisplayUrl('hello world')).toBe(`${new URL(PUBLIC_PAGE_ORIGIN).host}/hello%20world`);
  });
});

describe('public page publish issue focus', () => {
  it('resolves page settings and the missing-block action without translated labels', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-focus-page');

    expect(resolvePublishIssueFocusTarget(document, { code: 'invalid_slug', path: 'slug' }))
      .toEqual({ type: 'page-settings', marker: 'slug' });
    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_seo_title', path: 'seo.title' }))
      .toEqual({ type: 'page-settings', marker: 'seo.title' });
    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_visible_block', path: 'sections' }))
      .toEqual({ type: 'add-block' });
  });

  it('resolves explicit, server-id, and indexed block paths to their actual tabs', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-focus-block');
    const section = document.sections[0];
    const block = section.blocks[0];

    expect(resolvePublishIssueFocusTarget(document, {
      code: 'invalid_block', path: `sections.0.blocks.0.content.heading`, sectionId: section.id, blockId: block.id,
    })).toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'content', marker: 'block.content' });
    expect(resolvePublishIssueFocusTarget(document, {
      code: 'invalid_block', path: `blocks.${block.id}`,
    })).toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'content', marker: 'block.content' });
    expect(resolvePublishIssueFocusTarget(document, {
      code: 'invalid_document', path: 'sections.0.blocks.0.design.backgroundMediaId',
    })).toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'design', marker: 'block.design.backgroundMediaId' });
    expect(resolvePublishIssueFocusTarget(document, {
      code: 'invalid_document', path: 'sections.0.blocks.0.visible',
    })).toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'settings', marker: 'block.visible' });
    expect(resolvePublishIssueFocusTarget(document, {
      code: 'invalid_document', path: 'sections.0.design.backgroundColor',
    })).toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'section', marker: 'section.design' });
  });

  it('uses stable profile ownership before block media ownership', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-focus-media');
    const section = document.sections[0];
    const block = section.blocks[0];
    const media = { id: 'focus-media', url: 'https://example.com/focus.png', mimeType: 'image/png' as const, alt: '', width: 20, height: 20 };
    document.media.unshift(media);
    block.design.backgroundMediaId = media.id;
    document.profile.logoMediaId = media.id;

    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_alt', path: 'media.0.alt' }))
      .toEqual({ type: 'page-settings', marker: 'media:focus-media:alt' });

    document.profile.logoMediaId = null;
    expect(resolvePublishIssueFocusTarget(document, { code: 'invalid_media', path: 'media.0.url' }))
      .toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'design', marker: 'block.design.backgroundMediaId' });
  });

  it('resolves section and page background media to their existing exact controls', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-focus-backgrounds');
    const section = document.sections[0];
    const block = section.blocks[0];
    const sectionMedia = { id: 'section-background', url: 'https://example.com/section.png', mimeType: 'image/png' as const, alt: '', width: 20, height: 20 };
    const pageMedia = { id: 'page-background', url: 'https://example.com/page.png', mimeType: 'image/png' as const, alt: '', width: 20, height: 20 };
    document.media = [sectionMedia, pageMedia, ...document.media];
    section.design.backgroundMediaId = sectionMedia.id;
    document.theme.backgroundMediaId = pageMedia.id;

    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_alt', path: 'media.0.alt' }))
      .toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'section', marker: 'media:section-background:alt' });
    expect(resolvePublishIssueFocusTarget(document, { code: 'invalid_media', path: 'media.0.url' }))
      .toEqual({ type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'section', marker: 'section.design.backgroundMediaId' });
    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_alt', path: 'media.1.alt' }))
      .toEqual({ type: 'design-panel', marker: 'media:page-background:alt' });
  });

  it('resolves the second gallery item alt to its own input marker', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-focus-gallery');
    const section = document.sections[0];
    const gallery = section.blocks[0];
    gallery.type = 'gallery';
    gallery.id = 'focus-gallery';
    gallery.content = { images: [{ mediaId: 'gallery-one', alt: 'One' }, { mediaId: 'gallery-two', alt: '' }] };
    document.media = [
      { id: 'gallery-one', url: 'https://example.com/one.png', mimeType: 'image/png', alt: 'One', width: 20, height: 20 },
      { id: 'gallery-two', url: 'https://example.com/two.png', mimeType: 'image/png', alt: '', width: 20, height: 20 },
      ...document.media,
    ];

    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_alt', path: 'media.1.alt' }))
      .toEqual({ type: 'block-dialog', sectionId: section.id, blockId: gallery.id, tab: 'content', marker: 'media:gallery-two:alt' });
  });

  it('accepts publish validation results only for the revision that started the request', () => {
    expect(isPublishValidationResultCurrent(7, 7)).toBe(true);
    expect(isPublishValidationResultCurrent(7, 8)).toBe(false);
  });

  it('falls back for removed block ids, orphan media, and unmapped paths', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-focus-fallback');
    document.media.unshift({ id: 'orphan-media', url: 'https://example.com/orphan.png', mimeType: 'image/png', alt: '', width: 20, height: 20 });

    expect(resolvePublishIssueFocusTarget(document, {
      code: 'invalid_block', path: 'blocks.removed-block', blockId: 'removed-block',
    })).toEqual({ type: 'validation-alert' });
    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_alt', path: 'media.0.alt' }))
      .toEqual({ type: 'validation-alert' });
    expect(resolvePublishIssueFocusTarget(document, { code: 'invalid_document', path: 'theme.tokens.colors.focus' }))
      .toEqual({ type: 'validation-alert' });
  });
});

describe('public page editor publish lifecycle', () => {
  it('revalidates after an immediately resolved invalid publish', async () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-revalidate');
    document.seo.title = '';
    const editor = capturePublicPageEditor(document, createPublicPageRepositoryMock());

    const first = await editor.publish();
    expect(first.length).toBeGreaterThan(0);
    first.push({ code: 'invalid_document', path: 'mutated-first-result' });

    const second = await editor.publish();
    expect(second).not.toBe(first);
    expect(second.some((issue) => issue.path === 'mutated-first-result')).toBe(false);
  });

  it('clears the publish operation after save returns null', async () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('publish-save-null');
    document.seo.description = 'Valid public page description';
    const validBlockType = 'divider';
    if (!getBlockDefinition(validBlockType)) {
      registerBlock({
        type: validBlockType,
        name: 'Divider',
        createContent: () => ({}),
        Renderer: () => null,
        validate: () => [],
      });
    }
    document.sections = [{
      ...document.sections[0],
      blocks: [{ ...document.sections[0].blocks[0], type: validBlockType, content: {} }],
    }];
    expect(validateForPublish(document).issues).toEqual([]);
    let saveCalls = 0;
    let publishCalls = 0;
    const editor = capturePublicPageEditor(document, createPublicPageRepositoryMock({
      saveDraft: async () => {
        saveCalls += 1;
        throw new Error('save failed');
      },
      publish: async () => {
        publishCalls += 1;
        throw new Error('publish must not run');
      },
    }));

    expect(await editor.publish()).toEqual([]);
    expect(await editor.publish()).toEqual([]);
    expect(saveCalls).toBe(2);
    expect(publishCalls).toBe(0);
  });

  it('tracks only reducer actions that change document values', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('mutation-tracking');
    const state = {
      ...createEditorState(document),
      publishErrors: ['slug'],
    };
    const section = document.sections[0];
    const block = section.blocks[0];

    for (const action of [
      { type: 'section/reorder' as const, sectionId: section.id, toIndex: 0 },
      { type: 'block/reorder' as const, sectionId: section.id, blockId: block.id, toIndex: 0 },
      { type: 'layout/drop' as const, item: { type: 'section' as const, sectionId: section.id }, to: { type: 'main' as const, index: 0 } },
    ]) {
      const noOp = reduceEditorActionForMutationTracking(state, action);
      expect(noOp.documentChanged).toBe(false);
      expect(noOp.state).toBe(state);
      expect(noOp.state.publishErrors).toEqual(['slug']);
    }

    const changed = reduceEditorActionForMutationTracking(state, {
      type: 'slug/update', slug: 'changed-slug',
    });
    expect(changed.documentChanged).toBe(true);
    expect(changed.state).not.toBe(state);
    expect(changed.state.publishErrors).toEqual([]);
  });
});

describe('public page document model', () => {
  it('reports exact missing media paths for profile and SEO references', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('missing-profile-media');
    document.profile.logoMediaId = 'missing-logo';
    document.profile.avatarMediaId = 'missing-avatar';
    document.seo.imageMediaId = 'missing-seo-image';

    expect(validateForPublish(document).issues.filter((issue) => issue.code === 'missing_media' &&
      (issue.path.startsWith('profile.') || issue.path.startsWith('seo.'))).map((issue) => issue.path)).toEqual([
      'profile.logoMediaId',
      'profile.avatarMediaId',
      'seo.imageMediaId',
    ]);
  });

  it('always normalizes services to the canonical catalog-selection shape', () => {
    const oldShape = { title: 'Services', services: [{ id: 'old', title: 'Consultation' }] };
    expect(normalizeServicesContent(oldShape)).toEqual({
      title: 'Services', serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true,
    });

    expect(normalizeServicesContent({ ...oldShape, serviceIds: [3, 3, -1, 7], autoplayIntervalSeconds: 2 })).toEqual({
      title: 'Services', serviceIds: [3, 7], autoplayIntervalSeconds: null, showBookingButton: true,
    });
    expect(validateServicesBlockContent({ serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true }))
      .toContain('serviceIds must contain at least one service');
  });

  it('selects only active services assigned to an active specialist', () => {
    const response = {
      specialists: [{ id: 5, name: 'Active', isActive: true }, { id: 6, name: 'Inactive', isActive: false }],
      services: [],
    };
    const service = {
      id: 1, name: 'Service', description: null, basePrice: 10, baseDurationMinutes: 30,
      firstSessionFree: false, imageUrl: null, isActive: true,
      assignments: [{ specialistId: 5, specialistName: 'Active', isActive: true, priceOverride: null, durationOverrideMinutes: null }],
    };
    expect(isServiceSelectable(service, response)).toBe(true);
    expect(isServiceSelectable({ ...service, assignments: [{ ...service.assignments[0], specialistId: 6 }] }, response)).toBe(false);
    expect(isServiceSelectable({ ...service, isActive: false }, response)).toBe(false);
  });

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

  it('keeps section ids unique when normalizing an existing multi-block off group', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('existing-off-group');
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

  it.each([0, 1])('detaches the sole styled block at main boundary %s with its overrides and one undo entry', (index) => {
    const document = getPublicPageTemplate('beauty')!.createDocument('sole-detach');
    const source = document.sections[0];
    document.sections = [source];
    source.design.variant = 'primary';
    source.design.backgroundColor = '#123456';
    source.design.paddingTop = 42;
    const block = source.blocks[0];
    source.blocks = [block];
    block.design.textColor = '#abcdef';
    const before = structuredClone(document);
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: block.id }, to: { type: 'main', index },
    });
    expect(moved.document.sections).toHaveLength(1);
    expect(moved.document.sections[0].id).not.toBe(source.id);
    expect(moved.document.sections[0].design).toEqual(createEmptyPageSection('off').design);
    expect(moved.document.sections[0].blocks).toEqual([block]);
    expect(moved.document.media).toEqual(before.media);
    expect(moved.selection).toEqual({ sectionId: moved.document.sections[0].id, blockId: block.id });
    expect(moved.past).toHaveLength(1);
    const undone = editorReducer(moved, { type: 'history/undo' });
    expect(undone.document).toEqual(before);
    expect(editorReducer(undone, { type: 'history/redo' }).document).toEqual(moved.document);
  });

  it.each([0, 1, 2, 3])('corrects main boundary %s after pruning the middle source', (index) => {
    const document = getPublicPageTemplate('beauty')!.createDocument('boundary-detach');
    const first = document.sections[0];
    const source = document.sections[1];
    const last = { ...structuredClone(first), id: 'last-section', blocks: [{ ...structuredClone(first.blocks[0]), id: 'last-block' }] };
    document.sections = [first, source, last];
    for (const section of document.sections) {section.design.variant = 'primary';}
    const block = source.blocks[0];
    source.blocks = [block];
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: block.id }, to: { type: 'main', index },
    });
    const expectedIndex = index > 1 ? index - 1 : index;
    expect(moved.document.sections[expectedIndex].blocks).toEqual([block]);
    expect(moved.document.sections[expectedIndex].design.variant).toBe('off');
    expect(moved.document.sections.filter((section) => section.design.variant !== 'off')).toEqual([first, last]);
    expect(moved.document.sections.some((section) => section.id === source.id)).toBe(false);
  });

  it.each([0, 2])('reuses an adjacent off group at main boundary %s without copying the source style', (index) => {
    const document = getPublicPageTemplate('beauty')!.createDocument('reuse-main');
    const [source, off] = document.sections;
    source.design.variant = 'primary'; off.design.variant = 'off';
    const block = source.blocks[0];
    const sibling = { ...structuredClone(block), id: 'retained-main-sibling' };
    source.blocks = [block, sibling];
    document.sections = index === 0 ? [off, source] : [source, off];
    const moved = editorReducer(createEditorState(document), {
      type: 'layout/drop', item: { type: 'block', blockId: block.id }, to: { type: 'main', index },
    });
    expect(moved.document.sections).toHaveLength(2);
    expect(moved.document.sections.find((section) => section.id === source.id)?.blocks).toEqual([sibling]);
    expect(moved.document.sections.find((section) => section.id === off.id)?.blocks)
      .toEqual(index === 0 ? [block, ...off.blocks] : [...off.blocks, block]);
    expect(moved.past).toHaveLength(1);
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


  it('keeps unknown in-memory blocks recoverable while strict validation rejects them', () => {
    expect(validateSocialPlatforms({ platform: 'instagram' })).toEqual([]);
    expect(validateSocialPlatforms({ platform: 'myspace' })).toContain('platform is invalid');
    const document = getPublicPageTemplate('beauty')!.createDocument('social-normalization');
    document.sections[0].blocks.push({ ...document.sections[0].blocks[0], id: 'unsupported', type: 'socials' });
    document.sections[0].blocks.push({ ...document.sections[0].blocks[0], id: 'invalid', type: 'social-button', content: { platform: 'youtube', label: 'YouTube', url: 'https://youtube.com' } });
    document.sections[0].blocks.push({ ...document.sections[0].blocks[0], id: 'valid', type: 'social-button', content: { platform: 'vk', label: 'VK', url: 'https://vk.com' } });
    const normalized = normalizeDocument(document);
    expect(normalized.sections[0].blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['unsupported', 'invalid', 'valid']));
    expect(validateDocument(normalized).valid).toBe(false);
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
  it('creates every non-blank template with canonical avatar content and no persisted placeholder URL', () => {
    for (const template of PUBLIC_PAGE_TEMPLATES.filter(({ id }) => id !== 'blank')) {
      const document = template.createDocument(`test-${template.id}`, '2026-01-01T00:00:00.000Z');
      const visibleBlocks = document.sections
        .filter((section) => section.visible)
        .flatMap((section) => section.blocks.filter((pageBlock) => pageBlock.visible));
      const intro = visibleBlocks.find((pageBlock) => pageBlock.type === 'avatar');

      expect(visibleBlocks.length, template.id).toBeGreaterThan(1);
      expect(intro?.content.heading, template.id).toEqual(expect.any(String));
      expect(intro?.content.subtitle, template.id).toEqual(expect.any(String));
      expect(intro?.content, template.id).toMatchObject({
        imageMediaId: null, imageAlt: '', layout: 'centered', avatarSize: 150,
        coverColor: null, coverMediaId: null,
      });
      expect(intro?.content, template.id).not.toHaveProperty('imageUrl');
      expect(document.media, template.id).toEqual([]);
      expect(document.sections.every((section) => section.blocks.length === 1), template.id).toBe(true);
    }
  });

  it('creates renderable rich text for the Specialist about block', () => {
    const document = getPublicPageTemplate('specialist')!.createDocument('specialist-rich-text');
    const aboutBlock = document.sections.flatMap((section) => section.blocks)
      .find((pageBlock) => pageBlock.type === 'text');
    const richText = normalizeRichTextDocument(aboutBlock?.content.document);

    expect(aboutBlock?.content.document).toMatchObject({ type: 'rich-text-v1' });
    expect(richText.paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => run.text)))
      .toEqual(['About me', 'Describe your experience, approach, and who you help.']);
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

  it('uses only canonical avatar blocks in new templates', () => {
    for (const template of PUBLIC_PAGE_TEMPLATES.filter(({ id }) => id !== 'blank')) {
      const document = template.createDocument(`avatar-${template.id}`);
      expect(document.sections.flatMap((section) => section.blocks).some((block) => block.type === 'avatar')).toBe(true);
      expect(validateDocument(document).valid).toBe(true);
      expect(document.profile.displayName).toBe('');
    }
    expect(normalizeDocument({ profile: { displayName: 'Profile' } }).profile.displayName).toBe('Profile');
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

  it('rejects non-v4, incomplete profile and removed block shapes at the document boundary', () => {
    const document = getPublicPageTemplate('specialist')!.createDocument('schema-v4-only');
    expect(validateDocument({ ...document, schemaVersion: 1 }).valid).toBe(false);
    expect(validateDocument({ ...document, schemaVersion: undefined }).valid).toBe(false);
    const incompleteProfile: Record<string, unknown> = structuredClone(document.profile);
    delete incompleteProfile.avatarPosition;
    expect(validateDocument({ ...document, profile: incompleteProfile }).errors)
      .toContainEqual({ code: 'invalid_value', path: 'profile.avatarPosition' });
    expect(validateDocument({
      ...document,
      sections: [{ ...document.sections[0], blocks: [{ ...document.sections[0].blocks[0], type: 'hero' }] }],
    }).valid).toBe(false);
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

  it('expands a decorated section across contiguous off groups in visual order', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('resize-expand');
    const section = structuredClone(document.sections[0]);
    section.id = 'decorated';
    section.design.variant = 'primary';
    section.blocks = [{ ...structuredClone(section.blocks[0]), id: 'block-a' }];
    const firstOff = { ...structuredClone(section), id: 'off-1', design: { ...section.design, variant: 'off' as const }, blocks: [
      { ...structuredClone(section.blocks[0]), id: 'block-b' },
      { ...structuredClone(section.blocks[0]), id: 'block-c' },
    ] };
    const secondOff = { ...structuredClone(firstOff), id: 'off-2', blocks: [
      { ...structuredClone(section.blocks[0]), id: 'block-d' },
    ] };
    const boundary = { ...structuredClone(section), id: 'boundary', blocks: [
      { ...structuredClone(section.blocks[0]), id: 'block-e' },
    ] };
    document.sections = [section, firstOff, secondOff, boundary];

    const resized = editorReducer(createEditorState(document), {
      type: 'section/resize-membership', sectionId: section.id, targetBlockCount: 4,
    });

    expect(resized.document.sections.map((candidate) => candidate.id)).toEqual(['decorated', 'boundary']);
    expect(resized.document.sections[0].blocks.map((block) => block.id)).toEqual(['block-a', 'block-b', 'block-c', 'block-d']);
    expect(resized.document.sections[1].blocks.map((block) => block.id)).toEqual(['block-e']);
    expect(resized.past).toHaveLength(1);
    expect(editorReducer(resized, { type: 'history/undo' }).document).toEqual(document);
  });

  it('stops section expansion at the next decorated boundary and ignores invalid targets', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('resize-boundary');
    const decorated = structuredClone(document.sections[0]);
    decorated.id = 'decorated';
    decorated.design.variant = 'primary';
    decorated.blocks = [{ ...structuredClone(decorated.blocks[0]), id: 'block-a' }];
    const off = { ...structuredClone(decorated), id: 'off', design: { ...decorated.design, variant: 'off' as const }, blocks: [
      { ...structuredClone(decorated.blocks[0]), id: 'block-b' },
    ] };
    const boundary = { ...structuredClone(decorated), id: 'boundary', blocks: [
      { ...structuredClone(decorated.blocks[0]), id: 'block-c' },
    ] };
    document.sections = [decorated, off, boundary];
    const state = createEditorState(document);

    for (const targetBlockCount of [0, 1.5, 3]) {
      const unchanged = editorReducer(state, {
        type: 'section/resize-membership', sectionId: decorated.id, targetBlockCount,
      });
      expect(unchanged).toBe(state);
      expect(unchanged.past).toHaveLength(0);
    }
    expect(editorReducer(state, {
      type: 'section/resize-membership', sectionId: 'missing', targetBlockCount: 2,
    })).toBe(state);
    expect(editorReducer(state, {
      type: 'section/resize-membership', sectionId: off.id, targetBlockCount: 1,
    })).toBe(state);
  });

  it('keeps equal section membership as identity without adding history', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('resize-equal');
    const decorated = document.sections[0];
    decorated.design.variant = 'primary';
    const state = createEditorState(document);

    const equalCount = editorReducer(state, {
      type: 'section/resize-membership', sectionId: decorated.id, targetBlockCount: decorated.blocks.length,
    });

    expect(equalCount).toBe(state);
    expect(equalCount.past).toHaveLength(0);
  });

  it('shrinks into the immediate off group by prepending trailing blocks', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('resize-shrink-prepend');
    const decorated = structuredClone(document.sections[0]);
    decorated.id = 'decorated';
    decorated.design.variant = 'primary';
    decorated.blocks = ['block-a', 'block-b', 'block-c'].map((id) => ({ ...structuredClone(decorated.blocks[0]), id }));
    const off = { ...structuredClone(decorated), id: 'off', design: { ...decorated.design, variant: 'off' as const }, blocks: [
      { ...structuredClone(decorated.blocks[0]), id: 'block-d' },
    ] };
    document.sections = [decorated, off];

    const resized = editorReducer(createEditorState(document), {
      type: 'section/resize-membership', sectionId: decorated.id, targetBlockCount: 1,
    });

    expect(resized.document.sections.map((section) => section.id)).toEqual(['decorated', 'off']);
    expect(resized.document.sections[0].blocks.map((block) => block.id)).toEqual(['block-a']);
    expect(resized.document.sections[1].blocks.map((block) => block.id)).toEqual(['block-b', 'block-c', 'block-d']);
    expect(resized.past).toHaveLength(1);
    expect(editorReducer(resized, { type: 'history/undo' }).document).toEqual(document);
  });

  it('creates one normalized off group when shrinking before a decorated section', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('resize-shrink-create');
    const decorated = structuredClone(document.sections[0]);
    decorated.id = 'decorated';
    decorated.design.variant = 'primary';
    decorated.blocks = ['block-a', 'block-b'].map((id) => ({ ...structuredClone(decorated.blocks[0]), id }));
    const boundary = { ...structuredClone(decorated), id: 'decorated:after:resize', blocks: [
      { ...structuredClone(decorated.blocks[0]), id: 'block-c' },
    ] };
    document.sections = [decorated, boundary];

    const resized = editorReducer(createEditorState(document), {
      type: 'section/resize-membership', sectionId: decorated.id, targetBlockCount: 1,
    });
    const createdOff = resized.document.sections[1];
    const repeated = editorReducer(createEditorState(document), {
      type: 'section/resize-membership', sectionId: decorated.id, targetBlockCount: 1,
    });
    const redone = editorReducer(editorReducer(resized, { type: 'history/undo' }), { type: 'history/redo' });

    expect(resized.document.sections).toHaveLength(3);
    expect(createdOff.design.variant).toBe('off');
    expect(createdOff.id).toBe('decorated:after:resize:2');
    expect(repeated.document.sections[1].id).toBe(createdOff.id);
    expect(redone.document.sections[1].id).toBe(createdOff.id);
    expect(createdOff.blocks.map((block) => block.id)).toEqual(['block-b']);
    expect(new Set(resized.document.sections.map((section) => section.id)).size).toBe(3);
    expect(resized.document.sections[2].id).toBe('decorated:after:resize');
    expect(resized.past).toHaveLength(1);
    expect(editorReducer(resized, { type: 'history/undo' }).document).toEqual(document);
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

  it('preserves unrelated existing empty sections and ignores a stale move destination', () => {
    const document = getPublicPageTemplate('beauty')!.createDocument('existing-empty');
    const source = document.sections[0];
    const block = source.blocks[0];
    document.sections.push({ ...structuredClone(source), id: 'existing-empty-section', blocks: [] });

    const staleMove = editorReducer(createEditorState(document), {
      type: 'block/move-or-detach', fromSectionId: source.id, toSectionId: 'missing', block,
    });
    expect(staleMove.document).toEqual(document);
    expect(staleMove.past).toHaveLength(0);

    const removed = editorReducer(createEditorState(document), {
      type: 'block/remove', sectionId: source.id, blockId: block.id,
    });
    expect(removed.document.sections.some((section) => section.id === 'existing-empty-section')).toBe(true);
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
