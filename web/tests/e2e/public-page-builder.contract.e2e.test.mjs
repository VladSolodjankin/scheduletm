import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('public page builder source contracts', () => {
  it('keeps bounded reducer history and clears redo after a new edit', async () => {
    const reducer = await read('src/features/public-page-builder/model/editorReducer.ts');
    const editorTypes = await read('src/features/public-page-builder/types/editor.ts');

    assert.match(editorTypes, /EDITOR_HISTORY_LIMIT = 50/);
    assert.match(reducer, /past: \[\.\.\.state\.past, cloneDocument\(state\.document\)\]\.slice\(-EDITOR_HISTORY_LIMIT\)/);
    assert.match(reducer, /future: \[\]/);
    assert.match(reducer, /case 'history\/undo'[\s\S]*future: \[cloneDocument\(state\.document\), \.\.\.state\.future\]\.slice\(0, EDITOR_HISTORY_LIMIT\)/);
    assert.match(reducer, /case 'history\/redo'[\s\S]*future: state\.future\.slice\(1\)/);
  });

  it('reserves system slugs and enforces the documented slug shape', async () => {
    const slug = await read('src/features/public-page-builder/model/slug.ts');

    assert.match(slug, /SLUG_MIN_LENGTH = 3/);
    assert.match(slug, /SLUG_MAX_LENGTH = 40/);
    assert.ok(slug.includes('SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/'));
    for (const reserved of ['appointments', 'login', 'public-pages', 'register', 'settings', 'specialists', 'users']) {
      assert.match(slug, new RegExp(`'${reserved}'`));
    }
    assert.match(slug, /RESERVED_PUBLIC_PAGE_SLUGS\.has\(slug\) \? 'reserved' : null/);
  });

  it('registers the composable blocks while keeping legacy hero and unknown blocks recoverable', async () => {
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const registry = await read('src/features/public-page-builder/model/blockRegistry.ts');
    const renderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');

    const registeredTypes = [...registrations.matchAll(/^\s*\{ type: '([^']+)'/gm)]
      .map((match) => match[1]);
    assert.deepEqual(registeredTypes, [
      'hero', 'avatar', 'button', 'links', 'text', 'image', 'gallery', 'services',
      'contacts', 'social-button', 'map', 'divider', 'faq',
    ]);
    assert.match(registry, /getBlockDefinition\(type: string\): BlockDefinition \| undefined/);
    assert.match(renderer, /if \(!definition\)[\s\S]*UnknownBlockFallback/);
  });

  it('runs structural, slug, block, media, accessibility, and SEO publish validation', async () => {
    const validation = await read('src/features/public-page-builder/model/publishValidation.ts');

    for (const contract of [
      'validateDocument(document)',
      'validateSlug(document.slug)',
      'missing_visible_block',
      'unknown_block',
      'invalid_block',
      'invalid_cta',
      'missing_media',
      'missing_alt',
      'missing_accessible_label',
      'missing_seo_title',
      'missing_seo_description',
    ]) {
      assert.ok(validation.includes(contract), `missing publish validation contract: ${contract}`);
    }
  });

  it('keeps public routes last and outside protected MainLayout and RoleRoute', async () => {
    const router = await read('src/app/router.tsx');
    const mainLayoutEnd = router.indexOf('element: <PublicPageLayout />');
    const slugRoute = router.indexOf("path: '/:slug'");
    const adminRoute = router.indexOf("path: '/public-pages/:profileId/edit'");

    assert.ok(mainLayoutEnd > adminRoute);
    assert.ok(slugRoute > mainLayoutEnd);
    assert.doesNotMatch(router.slice(mainLayoutEnd), /<RoleRoute>|<MainLayout \/>/);
  });

  it('centralizes builder UI copy in translation dictionaries', async () => {
    const uiText = await read('src/components/public-page-builder/uiText.ts');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    assert.match(uiText, /satisfies Record<string, TranslationKey>/);
    assert.match(uiText, /dictionaries\[locale\]\.publicPageBuilder\[dictionaryKey\]/);
    assert.match(dictionaries, /publicPageBuilder:\s*\{/);
    assert.match(dictionaries, /unknownBlockTitle:/);
    assert.match(dictionaries, /unknownBlockDescription:/);
  });

  it('serializes saves and advances the server revision before retrying newer local edits', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const toolbar = await read('src/components/public-page-builder/BuilderToolbar.tsx');

    assert.match(editor, /if \(inFlightSaveRef\.current\)[\s\S]*return inFlightSaveRef\.current/);
    assert.match(editor, /serverRevisionRef\.current = saved\.revision;[\s\S]*localEditRevisionRef\.current !== localRevision[\s\S]*status: 'idle'/);
    assert.match(editor, /finally \{[\s\S]*inFlightSaveRef\.current = null/);
    assert.match(toolbar, /disabled=\{saveStatus === 'saving' \|\| props\.isPublishing\}[\s\S]*onClick=\{props\.onSave\}/);
    assert.match(toolbar, /disabled=\{saveStatus === 'saving' \|\| props\.isPublishing\}[\s\S]*onClick=\{props\.onPublish\}/);
  });

  it('autosaves only after ten seconds without document edits and tracks every mutating layout action', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');

    assert.match(editor, /autosaveMs = 10_000/);
    assert.match(editor, /const timeout = window\.setTimeout\(\(\) => void save\(\), autosaveMs\);[\s\S]*return \(\) => window\.clearTimeout\(timeout\)/);
    assert.match(editor, /\[autosaveMs, conflict, isPublishing, save, state\.dirty, state\.document, state\.saveStatus\]/);
    for (const action of ['layout/drop', 'block/create-with-section', 'block/move-or-detach']) {
      assert.match(editor, new RegExp(`case '${action.replace('/', '\\/')}':[\\s\\S]{0,500}localEditRevisionRef\\.current \\+= 1`));
    }
  });

  it('preserves edits made while publish is in flight and retries them at the returned revision', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');

    assert.match(editor, /if \(inFlightPublishRef\.current\)[\s\S]*return inFlightPublishRef\.current/);
    assert.match(editor, /const localRevision = localEditRevisionRef\.current;[\s\S]*setIsPublishing\(true\)/);
    assert.match(editor, /serverRevisionRef\.current = published\.revision/);
    assert.match(editor, /localEditRevisionRef\.current !== localRevision[\s\S]*status: 'idle'[\s\S]*return \[\]/);
    assert.match(editor, /if \(conflict !== undefined \|\| !state\.dirty \|\| state\.saveStatus === 'saving' \|\| isPublishing\)/);
    assert.match(editor, /finally \{[\s\S]*setIsPublishing\(false\)[\s\S]*inFlightPublishRef\.current = null/);
  });

  it('freezes stale writes after conflicts and reloads the latest server revision explicitly', async () => {
    const repository = await read('src/features/public-page-builder/repository/ApiPublicPageRepository.ts');
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const page = await read('src/pages/PublicPageEditorPage.tsx');

    assert.match(repository, /code === 'revision_conflict'[\s\S]*readRecord\(data\.current as ApiRecord\)[\s\S]*catch \{/);
    assert.match(editor, /if \(conflict !== undefined \|\| inFlightPublishRef\.current\)/);
    assert.match(editor, /if \(conflict !== undefined \|\| !state\.dirty/);
    assert.match(editor, /const latest = conflict \?\? await repository\.get/);
    assert.match(editor, /serverRevisionRef\.current = latest\.revision[\s\S]*document\/replace/);
    assert.match(page, /editor\.hasConflict[\s\S]*editor\.reloadLatest\(\)/);
  });

  it('propagates publish issue details and requires absolute HTTPS media URLs', async () => {
    const repository = await read('src/features/public-page-builder/repository/ApiPublicPageRepository.ts');
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const media = await read('src/features/public-page-builder/model/media.ts');
    const validation = await read('src/features/public-page-builder/model/publishValidation.ts');

    assert.match(repository, /code === 'publish_validation_failed'[\s\S]*value\.path[\s\S]*value\.detail/);
    assert.match(editor, /error\.issues \?\? \[\][\s\S]*issues\.map\(\(issue\) => issue\.path\)/);
    assert.match(media, /new URL\(value\)\.protocol === 'https:'/);
    assert.match(validation, /path: `media\.\$\{index\}\.url`, detail: mediaError/);
  });

  it('uploads media safely and renders page and block appearance settings', async () => {
    const repository = await read('src/features/public-page-builder/repository/ApiPublicPageRepository.ts');
    const upload = await read('src/components/public-page-builder/ImageUploadControl.tsx');
    const pageRenderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const blockRenderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');
    const presets = await read('src/features/public-page-builder/config/backgroundPresets.ts');

    assert.match(repository, /post<MediaReference>\('\/api\/public-pages\/media', file/);
    assert.match(repository, /media\/\$\{encodeURIComponent\(mediaId\)\}\/preview/);
    assert.match(upload, /5 \* 1024 \* 1024/);
    assert.match(upload, /image\/jpeg,image\/png,image\/webp/);
    assert.match(pageRenderer, /document\.theme\.fontFamily/);
    assert.match(blockRenderer, /backgroundOverlay/);
    assert.ok([...presets.matchAll(/id: '([^']+)'/g)].length >= 10);
  });

  it('deletes detached media only after save and retries published-snapshot conflicts', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');

    assert.match(page, /pendingMediaDeletionIdsRef/);
    assert.match(page, /if \(state\.dirty \|\| state\.saveStatus !== 'saved' \|\| editor\.isPublishing/);
    assert.match(page, /await repository\.deleteMedia\(id\)/);
    assert.match(page, /error\.code === 'media_in_use'/);
    assert.match(page, /URL\.revokeObjectURL\(previewUrl\)/);
    assert.match(page, /pendingMediaDeletionIdsRef\.current\.delete\(id\)/);
  });

  it('edits avatar, image, and gallery media through uploads instead of URL fields', async () => {
    const dialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const registry = await read('src/features/public-page-builder/config/registerBlocks.ts');
    assert.match(dialog, /draft\.type === 'avatar' \|\| draft\.type === 'image'/);
    assert.match(dialog, /draft\.type === 'gallery'/);
    assert.match(dialog, /originalGalleryMediaIds/);
    assert.doesNotMatch(blocks, /avatar: \{ fields: \[[^\]]*imageUrl/);
    assert.doesNotMatch(blocks, /image: \{ fields: \[[^\]]*url/);
    assert.match(registry, /type: 'image'[\s\S]{0,180}imageMediaId: null/);
    assert.match(registry, /type: 'gallery'[\s\S]{0,180}images: \[\]/);
  });

  it('uses one section surface and exposes shared section design in the block editor', async () => {
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const blockRenderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const dialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const library = await read('src/components/public-page-builder/AddBlockDialog.tsx');
    const templates = await read('src/features/public-page-builder/templates/index.ts');

    assert.match(renderer, /section\.design\.backgroundColor/);
    assert.match(renderer, /pt: isOff \? 0 : `\$\{section\.design\.paddingTop\}px`/);
    assert.match(renderer, /pb: isOff \? 0 : `\$\{section\.design\.paddingBottom\}px`/);
    assert.match(renderer, /pl: isOff \? 0 : `calc\(1rem \+ \$\{borderWidth\}px\)`/);
    assert.match(renderer, /boxSizing: 'border-box'/);
    assert.match(renderer, /const sectionInlineMargin = section\.design\.horizontalMargin \? '1rem' : '0px'/);
    assert.match(renderer, /\? `min\(calc\(100% - \$\{sectionInlineMargin\} - \$\{sectionInlineMargin\}\), 720px\)`[\s\S]{0,80}: 'auto'/);
    assert.match(renderer, /ml: section\.design\.width === 'contained' \? 'auto' : sectionInlineMargin/);
    assert.match(renderer, /mr: section\.design\.width === 'contained' \? 'auto' : sectionInlineMargin/);
    const editorBlockWrapper = renderer.slice(renderer.indexOf('const renderBlock ='), renderer.indexOf('return (', renderer.indexOf('const renderBlock =')));
    assert.doesNotMatch(editorBlockWrapper, /borderRadius/);
    assert.match(renderer, /borderRadius: isOff[\s\S]{0,30}\? 0[\s\S]{0,80}: sectionThemeRadius\(theme\.roundingStyle, theme\.styleDefaults\.blockBorderRadius\)/);
    assert.doesNotMatch(renderer, /section\.design\.borderRadius/);
    assert.doesNotMatch(renderer, /sectionThemeRadius\(theme\.roundingStyle, theme\.styleDefaults\.sectionBorderRadius\)/);
    assert.match(blockRenderer, /style === 'pill'\) \{return '40px';\}/);
    assert.match(blockRenderer, /sectionThemeRadius[\s\S]{0,180}style === 'pill'\) \{return '40px';\}/);
    assert.match(blockRenderer, /sectionThemeRadius[\s\S]{0,240}style === 'square'\) \{return '2px';\}[\s\S]{0,80}return `\$\{roundedRadius\}px`/);
    assert.match(renderer, /borderRadius: themeRadius\(theme\.roundingStyle, theme\.styleDefaults\.blockBorderRadius\)/);
    assert.match(renderer, /'--theme-link-border-radius': themeRadius\(document\.theme\.roundingStyle, document\.theme\.styleDefaults\.blockBorderRadius\)/);
    const rendererWrapper = blockRenderer.slice(blockRenderer.indexOf('return <Box sx='), blockRenderer.indexOf('<BlockErrorBoundary'));
    assert.match(blockRenderer, /blockSurfaceRadius\(block\.design\.borderRadius, roundingStyle, themeBorderRadius\)/);
    assert.match(rendererWrapper, /hasSurface[\s\S]*borderRadius: hasSurface \? surfaceRadius : undefined[\s\S]*overflow: hasSurface/);
    assert.match(rendererWrapper, /pt: `\$\{block\.design\.paddingTop \?\? 0\}px`/);
    assert.match(rendererWrapper, /bgcolor: hasSurface \? block\.design\.backgroundColor/);
    const buttonBlock = blocks.slice(blocks.indexOf('export function ButtonBlock'), blocks.indexOf('export function LinksBlock'));
    assert.match(buttonBlock, /borderRadius: 'var\(--theme-link-border-radius, 24px\)'/);
    assert.doesNotMatch(blocks, /block\.content\.radius/);
    const surface = (await read('src/components/public-page-blocks/blocks.tsx')).slice(
      (await read('src/components/public-page-blocks/blocks.tsx')).indexOf('function Surface'),
      (await read('src/components/public-page-blocks/blocks.tsx')).indexOf('function hrefFor'),
    );
    assert.doesNotMatch(surface, /borderRadius|bgcolor|p:/);
    const blockSettings = dialog.slice(dialog.indexOf('{tab === 1'), dialog.indexOf('{tab === 2'));
    assert.doesNotMatch(blockSettings, /draft\.design\.borderRadius|label=\{publicPageText\(locale, 'borderRadius'\)\}/);
    const sectionSettings = dialog.slice(dialog.indexOf('{tab === 2'), dialog.indexOf('</DialogContent>'));
    assert.doesNotMatch(sectionSettings, /sectionDraft\.design\.borderRadius|label=\{publicPageText\(locale, 'borderRadius'\)\}|'borderRadius'/);
    assert.match(renderer, /borderWidth: `\$\{borderWidth\}px`/);
    assert.match(renderer, /borderColor: isOff \? 'transparent' : section\.design\.borderColor \?\? 'transparent'/);
    assert.match(dialog, /tabContent[\s\S]*tabSettings[\s\S]*tabSection/);
    for (const field of ['paddingTop', 'paddingBottom', 'horizontalMargin', 'borderWidth', 'borderColor']) {
      assert.match(dialog, new RegExp(field));
    }
    assert.match(library, /filter\(\(\{ type \}\) => type !== 'hero' && type !== 'social-button'\)/);
    assert.doesNotMatch(templates, /block\(`\$\{id\}-hero`/);
    assert.match(templates, /block\(`\$\{id\}-avatar`, 'avatar'/);
    assert.match(templates, /block\(`\$\{id\}-button`, 'button'/);
    assert.match(templates, /sections: blocks\.map/);
    for (const variant of ['sectionOff', 'newSection', 'sectionsFromDesign', 'primarySection', 'secondarySection']) {
      assert.match(dialog, new RegExp(variant));
    }
    assert.doesNotMatch(dialog, /CREATE_NEW_SECTION_VALUE|createNewSection/);
  });

  it('creates, moves, and detaches blocks through single lifecycle reducer commits', async () => {
    const actions = await read('src/features/public-page-builder/types/actions.ts');
    const reducer = await read('src/features/public-page-builder/model/editorReducer.ts');
    const page = await read('src/pages/PublicPageEditorPage.tsx');

    assert.match(actions, /block\/create-with-section/);
    assert.match(actions, /block\/move-or-detach/);
    assert.match(reducer, /case 'block\/create-with-section'/);
    assert.match(reducer, /case 'block\/move-or-detach'/);
    assert.match(reducer, /function removeBlockAndPruneSource/);
    assert.match(reducer, /section\.id !== sectionId/);
    assert.match(page, /setStagedBlocks\(\(current\) => \[\.\.\.current, block\]\)/);
    assert.match(page, /type: 'layout\/drop'/);
    assert.match(page, /const alreadyCommitted = state\.document\.sections\.some/);
    assert.match(page, /if \(alreadyCommitted \|\| targetMissing\) \{return;\}/);
    assert.match(page, /setStagedBlocks\(\(current\) => current\.filter\(\(block\) => block\.id !== payload\.block\.id\)\)/);
    assert.doesNotMatch(page, /type: 'block\/create-with-section'/);
    assert.match(page, /type: 'block\/move-or-detach'/);
    assert.doesNotMatch(page, /type: 'section\/add'[\s\S]{0,400}type: 'block\/add'/);
  });

  it('uses direct smooth-dnd containers with one atomic drop and visible handles', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const sortableBuilder = await read('src/components/public-page-builder/BuilderSortable.tsx');
    const blockEditor = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const editorHook = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    assert.match(sortableBuilder, /from 'smooth-dnd'/);
    assert.match(sortableBuilder, /smoothDnD\.dropHandler = dropHandlers\.reactDropHandler\(\)\.handler/);
    assert.match(sortableBuilder, /smoothDnD\.wrapChild = false/);
    assert.match(sortableBuilder, /useLayoutEffect/);
    assert.match(sortableBuilder, /onDrop: \(result\) => requestAnimationFrame/);
    assert.match(sortableBuilder, /disposed = true;[\s\S]{0,80}instance\.dispose\(\)/);
    assert.match(sortableBuilder, /getGhostParent: \(\) => document\.body/);
    assert.match(sortableBuilder, /SMOOTH_DND_WRAPPER_CLASS = constants\.wrapperClass/);
    assert.match(renderer, /useSmoothDndContainer\(mainContainerRef/);
    assert.match(renderer, /useSmoothDndContainer\(blockContainerRef/);
    assert.match(renderer, /useSmoothDndContainer\(stagedContainerRef/);
    assert.match(renderer, /payload\.type !== 'section'/);
    assert.match(renderer, /data-public-page-main-container/);
    assert.match(renderer, /data-public-page-block-container=\{section\.id\}/);
    assert.match(renderer, /className=\{SMOOTH_DND_WRAPPER_CLASS\}/);
    assert.match(page, /const onDropItem = \(payload: BuilderDragPayload, destination: BuilderDropDestination\)/);
    assert.match(page, /type: 'layout\/drop'/);
    assert.match(editorHook, /case 'layout\/drop':[\s\S]{0,600}localEditRevisionRef\.current \+= 1/);
    assert.match(blockEditor, /if \(!open \|\| !block\) \{return null;\}/);
    assert.doesNotMatch(page + renderer + sortableBuilder, /@dnd-kit|DndContext|SortableContext|DragOverlay|useSortable|useDraggable/);
    assert.doesNotMatch(page, /dragPreviewDocument|activeDrag|onDndOver|collisionDetection/);
    assert.doesNotMatch(renderer, /PublicPageDragPreview|chromeFreeBlockPreview/);
    assert.match(renderer, /const heading = isOff \? theme\.styleDefaults\.headingStyle :/);
    assert.match(renderer, /const link = isOff \? theme\.styleDefaults\.linkStyle : section\.design\.linkStyle/);
    assert.match(page, /renderBlockDragHandle:[\s\S]*data-public-page-block-drag-rail[\s\S]*var\(--public-page-editor-drag-gutter\)[\s\S]*top: '50%'[\s\S]*width: 36[\s\S]*height: 48/);
    assert.doesNotMatch(page, /data-public-page-block-drag-rail[\s\S]{0,500}minHeight/);
    assert.match(page, /renderSectionDragHandle:[\s\S]*data-public-page-section-drag-rail[\s\S]*top: 0[\s\S]*left: '50%'[\s\S]*translate\(-50%, -50%\)[\s\S]*width: 48[\s\S]*height: 24/);
    assert.match(renderer, /data-public-page-section-drag-target=\{editor \? section\.id : undefined\}/);
    assert.doesNotMatch(renderer, /'&::after'/);
    assert.doesNotMatch(page + renderer, /renderSectionResizeHandle|section\/resize-membership|sectionResizePreview/);
    assert.match(renderer, /const mainItems = useMemo/);
    assert.match(renderer, /section\.design\.variant === 'off'[\s\S]{0,180}type: 'free-block'/);
    assert.match(renderer, /data-public-page-free-block/);
    assert.match(renderer, /if \(!editor && \(!section\.visible \|\| section\.blocks\.length === 0\)\)/);
    assert.match(renderer, /: document\.sections\.map\(\(section, sectionIndex\) => <SectionRenderer/);
    assert.match(renderer, /px: \{ xs: 2, sm: 3 \}/);
    assert.match(renderer, /borderRadius: '24px'/);
    assert.match(renderer, /'--theme-link-border-radius': themeRadius\(document\.theme\.roundingStyle, document\.theme\.styleDefaults\.blockBorderRadius\)/);
    const preview = await read('src/components/public-page-builder/ResponsivePreview.tsx');
    assert.match(preview, /overflow: editor \? 'visible' : 'hidden'/);
    assert.match(preview, /border: `\$\{theme\.spacing\(1\.25\)\} solid \$\{theme\.palette\.common\.white\}`/);
    assert.doesNotMatch(preview, /#202124/);
    assert.match(preview, /'& > \*': \{ width: '100%', minWidth: 0, flex: '1 0 auto', boxSizing: 'border-box' \}/);
    assert.match(preview, /'& > \* > \.MuiContainer-root': editor \? \{[\s\S]{0,120}width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'/);
    assert.match(preview, /const editorDragGutter = 64/);
    assert.match(preview, /width: editor[\s\S]{0,220}`\$\{widths\[device\] \+ editorDragGutter \+ editorFrameBorder \* 2\}px`[\s\S]{0,220}: `min\(100%, \$\{widths\[device\]}px\)`/);
    assert.match(preview, /width: editor \? `\$\{widths\[device\]}px` : '100%'/);
    assert.match(preview, /boxSizing: editor \? 'content-box' : 'border-box'/);
    assert.match(preview, /borderRadius: 32/);
    assert.match(preview, /borderRadius: showPhoneFrame \? undefined : 0/);
    assert.match(preview, /pl: editor \? `\$\{editorDragGutter\}px` : 0/);
    assert.match(preview, /display: 'flex', flexDirection: 'column'/);
    assert.match(preview, /flex: '1 0 auto'/);
    assert.match(renderer, /maxWidth: 320/);
  });

  it('shows a live read-only mobile preview beside the design settings', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const preview = await read('src/components/public-page-builder/ResponsivePreview.tsx');
    const designStart = page.indexOf('<Dialog open={designOpen}');
    const designDialog = page.slice(designStart, page.indexOf('</Dialog>', designStart));

    assert.match(designDialog, /maxWidth="lg"/);
    assert.match(designDialog, /gridTemplateColumns: \{ xs: 'minmax\(0, 1fr\)', lg: 'minmax\(0, 430px\) minmax\(0, 1fr\)' \}/);
    assert.match(designDialog, /<ResponsivePreview document=\{state\.document\} device="mobile" mediaUrls=\{mediaUrls\} framed interactive=\{false\}/);
    assert.doesNotMatch(designDialog, /<ResponsivePreview[^>]*editor=/);
    assert.ok(designDialog.indexOf('<ResponsivePreview') < designDialog.indexOf('<DesignPanel'));
    assert.match(designDialog, /overflow: \{ xs: 'visible', lg: 'auto' \}/);

    assert.match(preview, /framed = false/);
    assert.match(preview, /interactive = true/);
    assert.match(preview, /ariaLabel\?: string/);
    assert.match(preview, /const PreviewScroller = styled\(Box\)\(\{[\s\S]{0,100}overflow: 'auto'/);
    assert.match(preview, /<PreviewScroller role=\{ariaLabel \? 'region' : undefined\} tabIndex=\{ariaLabel \? 0 : undefined\} aria-label=\{ariaLabel\}/);
    assert.match(preview, /px: editor \? 1 : framed \? 1 : \{ xs: 1, md: 3 \}/);
    assert.match(preview, /<PreviewFrame[\s\S]{0,120}inert: true, 'aria-hidden': true/);
    assert.match(preview, /!interactive \? \{ '& a, & button, & \[role="button"\]': \{ pointerEvents: 'none' \} \} : \{\}/);
    const scrollerStart = preview.indexOf('<PreviewScroller');
    const frameStart = preview.indexOf('<PreviewFrame', scrollerStart);
    assert.doesNotMatch(preview.slice(scrollerStart, frameStart), /pointerEvents: 'none'|inert|aria-hidden/);
    assert.match(preview, /framed[\s\S]{0,100}`min\(100%, \$\{widths\.mobile \+ editorFrameBorder \* 2\}px\)`/);
    assert.match(page, /<ResponsivePreview document=\{previewDocument\} device=\{device\} mediaUrls=\{previewMediaUrls\}[\s\S]{0,100}ariaLabel=\{publicPageText\(locale, 'preview'\)\} editor=\{\{/);
  });

  it('offers individual branded social buttons in accessible duplicate-aware grids', async () => {
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const platforms = await read('src/features/public-page-builder/model/socialPlatforms.ts');
    const addDialog = await read('src/components/public-page-builder/AddBlockDialog.tsx');
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const sortable = await read('src/components/public-page-builder/SortableList.tsx');

    for (const platform of ['facebook-messenger', 'vk', 'whatsapp', 'viber', 'telegram', 'facebook', 'threads', 'instagram', 'tiktok']) {
      assert.match(platforms, new RegExp(`'${platform}'`));
    }
    for (const retired of ['x', 'linkedin', 'youtube']) assert.doesNotMatch(platforms, new RegExp(`'${retired}'`));
    assert.match(blocks, /export function SocialPlatformIcon/);
    assert.match(blocks, /role="radiogroup"/);
    assert.match(blocks, /role="radio" aria-checked=\{selected\}/);
    assert.match(blocks, /tabIndex=\{selected \? 0 : -1\}/);
    assert.match(blocks, /event\.key === 'Home'/);
    assert.match(blocks, /event\.key === 'End'/);
    assert.match(blocks, /event\.key === 'ArrowRight' \|\| event\.key === 'ArrowDown'/);
    assert.match(blocks, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowUp'/);
    assert.match(blocks, /const avatarLayouts = \['centered', 'image-left', 'image-right', 'compact'\] as const/);
    assert.match(blocks, /<SocialPlatformIcon className="social-button__icon" platform=\{platform\} aria-hidden="true"[\s\S]{0,180}position: 'absolute', left: 18/);
    assert.match(blocks, /color: style\.iconColor/);
    assert.doesNotMatch(blocks.slice(blocks.indexOf('export function SocialButtonBlock'), blocks.indexOf('export function MapBlock')), /startIcon=/);
    assert.match(blocks, /export function SocialButtonBlock/);
    assert.match(blocks, /data-social-button=\{platform\}/);
    assert.match(addDialog, /role="group" aria-label=/);
    assert.match(addDialog, /disabled=\{disabled\}/);
    assert.match(page, /usedPlatforms=\{usedSocialPlatforms\}/);
    assert.match(page, /function canDuplicateBlocks\(blocks: readonly PageBlock\[\]\)/);
    assert.match(page, /!canDuplicateBlocks\(section\.blocks\)/);
    assert.match(page, /!canDuplicateBlocks\(\[block\]\)/);
    const avatarRenderer = blocks.slice(blocks.indexOf('export function AvatarBlock'), blocks.indexOf('export function ButtonBlock'));
    const textRenderer = blocks.slice(blocks.indexOf('export function TextBlock'), blocks.indexOf('export function ImageBlock'));
    assert.doesNotMatch(avatarRenderer, /<Surface|bgcolor: 'background\.paper'|borderRadius: 3/);
    assert.doesNotMatch(textRenderer, /<Surface/);
    assert.match(blocks, /maxWidth: '100%', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'/);
    const publicRenderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    assert.match(publicRenderer, /a:not\(\[data-social-button\]\)/);
    assert.doesNotMatch(publicRenderer, /'& a, & a\.MuiButtonBase-root'/);
    assert.doesNotMatch(registrations, /Editor: GenericBlockEditor/);
    assert.match(registrations, /validateSocialPlatforms\(content\)/);
    assert.match(sortable, /aria-label=\{`\$\{publicPageText\(locale, 'moveUp'\)/);
    assert.match(sortable, /aria-label=\{`\$\{publicPageText\(locale, 'moveDown'\)/);
  });

  it('blocks block-editor save when replacement and rollback media cleanup both fail', async () => {
    const dialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');

    assert.match(dialog, /const oldPending = pending\.find/);
    assert.match(dialog, /if \(oldPending && !\(await cleanupItems\(\[oldPending\]\)\)\) \{ await cleanupItems\(\[uploadedItem\]\); return; \}/);
    assert.match(dialog, /disabled=\{cleaning \|\| cleanupError\}[\s\S]*onClick=\{\(\) => onSave\(/);
  });

  it('does not expose archived-page editing', async () => {
    const pages = await read('src/pages/PublicPagesPage.tsx');

    assert.match(pages, /record\.status !== 'archived'[\s\S]*<Edit/);
    assert.match(pages, /window\.confirm\(publicPageText\(locale, 'deleteConfirm'\)\)/);
  });

  it('creates a page from the currently selected template', async () => {
    const pages = await read('src/pages/PublicPagesPage.tsx');

    assert.match(pages, /getPublicPageTemplate\(templateId\)\?\.createDocument\(createStableId\(\)\)/);
    assert.match(pages, /const created = await repository\.create\(document\)/);
  });

  it('declares public booking and status routes before the generic slug route', async () => {
    const router = await read('src/app/router.tsx');
    const bookingRoute = router.indexOf("path: '/:slug/booking'");
    const statusRoute = router.indexOf("path: '/:slug/appointment-status'");
    const genericRoute = router.indexOf("path: '/:slug'");

    assert.ok(bookingRoute > 0 && bookingRoute < genericRoute);
    assert.ok(statusRoute > 0 && statusRoute < genericRoute);
  });

  it('uses public booking/status contracts without exposing personal status data', async () => {
    const booking = await read('src/pages/PublicPageBookingPage.tsx');
    const status = await read('src/pages/PublicAppointmentStatusPage.tsx');

    assert.match(booking, /booking-options/);
    assert.match(booking, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
    assert.match(booking, /data\.specialists\.length === 1/);
    assert.match(booking, /data\.services\.length === 1/);
    assert.match(status, /specialistLastName/);
    assert.match(status, /PublicAppointmentMeetingStatus/);
    assert.doesNotMatch(status, /meeting\.client|meeting\.email|meeting\.phone/);
  });

  it('sends recurrence only for appointment creation', async () => {
    const dialog = await read('src/components/appointments/AppointmentFormDialog.tsx');
    const container = await read('src/containers/AppointmentsContainer.tsx');

    assert.match(dialog, /!editingItem && form\.recurrenceFrequency !== 'none'/);
    assert.match(dialog, /frequency: form\.recurrenceFrequency, occurrences: form\.recurrenceOccurrences/);
    assert.match(container, /\.\.\.\(payload\.recurrence \? \{ recurrence: payload\.recurrence \} : \{\}\)/);
  });

  it('applies link opacity to the background without fading foreground content', async () => {
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');

    assert.match(renderer, /backgroundColor: `color-mix\(in srgb, \$\{linkBackgroundColor\} \$\{linkBackgroundOpacity \* 100\}%, transparent\)`/);
    assert.doesNotMatch(renderer, /opacity: link\.backgroundOpacity \?\? linkDefault\.backgroundOpacity/);
  });
});
