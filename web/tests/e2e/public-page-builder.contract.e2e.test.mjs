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
    for (const reserved of ['appointments', 'booking', 'login', 'public-pages', 'register', 'settings', 'specialists', 'users']) {
      assert.match(slug, new RegExp(`'${reserved}'`));
    }
    assert.match(slug, /RESERVED_PUBLIC_PAGE_SLUGS\.has\(slug\) \? 'reserved' : null/);
  });

  it('registers only schema-v4 blocks while keeping unknown renderer failures recoverable', async () => {
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const registry = await read('src/features/public-page-builder/model/blockRegistry.ts');
    const renderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');
    const types = await read('src/features/public-page-builder/types/publicPage.ts');
    const addDialog = await read('src/components/public-page-builder/AddBlockDialog.tsx');
    const templates = await read('src/features/public-page-builder/templates/index.ts');

    const registeredTypes = [...registrations.matchAll(/^\s*\{ type: '([^']+)'/gm)]
      .map((match) => match[1]);
    assert.deepEqual(registeredTypes, [
      'avatar', 'button', 'links', 'text', 'image', 'gallery', 'services',
      'contacts', 'social-button', 'map', 'divider', 'faq',
    ]);
    assert.match(types, /PUBLIC_PAGE_SCHEMA_VERSION = 4 as const/);
    assert.doesNotMatch(types, /\| 'hero'/);
    assert.doesNotMatch(registrations, /type: 'hero'/);
    assert.doesNotMatch(templates, /-hero`|'hero'/);
    assert.doesNotMatch(addDialog, /type !== 'hero'/);
    assert.match(registry, /getBlockDefinition\(type: string\): BlockDefinition \| undefined/);
    assert.match(renderer, /if \(!definition\)[\s\S]*UnknownBlockFallback/);
  });

  it('keeps Contacts editing and rendering on typed actions only', async () => {
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const cta = await read('src/features/public-page-builder/model/cta.ts');
    const templates = await read('src/features/public-page-builder/templates/index.ts');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    assert.match(registrations, /type: 'contacts'[\s\S]*action: \{ type: 'email', email: 'hello@example\.com' \}[\s\S]*validateContacts\(content\.contacts\)/);
    assert.match(blocks, /contacts: \{ fields: \['title'\], list: \{ key: 'contacts', fields: \['label'\] \} \}/);
    assert.doesNotMatch(blocks + cta, /contactActionForEditor|normalizeLegacyContactHref/);
    assert.match(blocks, /ActionEditor value=\{row\.action as Record<string, unknown>\}/);
    assert.match(blocks, /export function ContactsBlock[\s\S]*contactHref\(item\)[\s\S]*if \(contacts\.length === 0\) \{return null;\}/);
    assert.match(cta, /return isCtaAction\(value\.action\) \? ctaActionToHref\(value\.action\) : null/);
    const contactHref = cta.slice(cta.indexOf('export function contactHref'), cta.indexOf('export function validateContacts'));
    assert.doesNotMatch(contactHref, /value\.url|mailto:|tel:/);
    assert.doesNotMatch(cta, /contacts\.\$\{index\}\.action is unsafe/);
    assert.doesNotMatch(templates, /type: 'contacts'[\s\S]{0,250}\burl: '(?:mailto|tel):/);
    assert.equal([...dictionaries.matchAll(/fieldAction: 'Action'/g)].length, 1);
    assert.equal([...dictionaries.matchAll(/fieldAction: 'Действие'/g)].length, 1);
  });

  it('fails closed when API documents are missing, invalid, or not schema v4', async () => {
    const repository = await read('src/features/public-page-builder/repository/ApiPublicPageRepository.ts');
    const validator = await read('src/features/public-page-builder/model/validateDocument.ts');

    assert.match(repository, /isPublicPageDocument\(value\)/);
    assert.match(repository, /validateDocument\(value\)/);
    assert.match(repository, /schemaVersion !== PUBLIC_PAGE_SCHEMA_VERSION/);
    assert.match(repository, /'unsupported_version' : 'invalid_document'/);
    assert.doesNotMatch(repository, /migrateDocument|normalizeDocument/);
    assert.match(validator, /knownBlockTypes = new Set\(\[[\s\S]*'avatar'[\s\S]*'faq'/);
    assert.doesNotMatch(validator, /knownBlockTypes[\s\S]{0,220}'hero'/);
    assert.match(validator, /case 'contacts':[\s\S]*\['id', 'label', 'action'\]/);
    assert.match(validator, /case 'services':[\s\S]*\['title', 'serviceIds', 'autoplayIntervalSeconds', 'showBookingButton'\]/);
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

  it('lazy-loads leaf routes while preserving route guards and public block registration', async () => {
    const router = await read('src/app/router.tsx');
    const app = await read('src/app/App.tsx');
    const appErrorBoundary = await read('src/app/AppErrorBoundary.tsx');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');
    const pageNames = [
      'LoginPage', 'RegisterPage', 'InviteAcceptPage', 'AppointmentsPage', 'SettingsPage',
      'SpecialistsPage', 'ServicesPage', 'UsersPage', 'NotificationLogsPage', 'ErrorLogsPage',
      'PrivacyPolicyPage', 'SecurityPolicyPage', 'PublicPagesPage', 'PublicPageEditorPage',
      'PublicPageViewPage', 'PublicPageBookingPage', 'PublicAppointmentStatusPage',
    ];

    for (const pageName of pageNames) {
      assert.match(router, new RegExp(`import\\('\\.\\.\\/pages\\/${pageName}'\\)`));
      assert.doesNotMatch(router, new RegExp(`import\\s+\\{[^}]*\\b${pageName}\\b[^}]*\\}\\s+from\\s+['\"]\\.\\.\\/pages\\/${pageName}['\"]`));
    }

    assert.doesNotMatch(router, /import\s+\{\s*registerPublicPageBlocks\s*\}\s+from/);
    assert.doesNotMatch(router, /^registerPublicPageBlocks\(\);/m);
    for (const pageName of ['PublicPagesPage', 'PublicPageEditorPage', 'PublicPageViewPage']) {
      const loaderStart = router.indexOf(`const ${pageName} = lazy(async () => {`);
      const loaderEnd = router.indexOf('\n});', loaderStart);
      const loader = router.slice(loaderStart, loaderEnd);
      assert.ok(loaderStart > 0 && loaderEnd > loaderStart);
      assert.match(loader, /Promise\.all\(\[[\s\S]*import\('\.\.\/features\/public-page-builder\/config\/registerBlocks'\)[\s\S]*\]\)/);
      assert.ok(loader.indexOf('registryModule.registerPublicPageBlocks();') < loader.indexOf(`return { default: pageModule.${pageName} };`));
    }
    for (const pageName of ['PublicPageBookingPage', 'PublicAppointmentStatusPage']) {
      const loaderLine = router.split('\n').find((line) => line.includes(`const ${pageName} = lazy(`));
      assert.ok(loaderLine);
      assert.doesNotMatch(loaderLine, /registerBlocks|registerPublicPageBlocks/);
    }

    for (const [path, guard, pageName] of [
      ['/login', 'PublicOnlyRoute', 'LoginPage'],
      ['/appointments', 'ProtectedRoute', 'AppointmentsPage'],
      ['/public-pages', 'RoleRoute', 'PublicPagesPage'],
      ['/public-pages/new', 'RoleRoute', 'PublicPageEditorPage'],
      ['/public-pages/:profileId/edit', 'RoleRoute', 'PublicPageEditorPage'],
    ]) {
      const routeStart = router.indexOf(`path: '${path}'`);
      const route = router.slice(routeStart, router.indexOf('\n      },', routeStart) + 9);
      assert.ok(routeStart > 0);
      assert.match(route, new RegExp(`<${guard}>[\\s\\S]*<${pageName} \\/>[\\s\\S]*<\\/${guard}>`));
    }

    assert.match(app, /<Suspense fallback=\{<RouteLoadingFallback \/>\}>[\s\S]*<RouterProvider router=\{router\} \/>[\s\S]*<\/Suspense>/);
    const outerBoundaryStart = app.indexOf('<AppErrorBoundary>');
    const i18nProviderStart = app.indexOf('<I18nProvider>');
    const innerBoundaryStart = app.indexOf('<AppErrorBoundary>', outerBoundaryStart + 1);
    const suspenseStart = app.indexOf('<Suspense', innerBoundaryStart);
    const routerProviderStart = app.indexOf('<RouterProvider router={router} />', suspenseStart);
    const i18nProviderEnd = app.indexOf('</I18nProvider>', routerProviderStart);
    assert.ok(outerBoundaryStart > 0 && outerBoundaryStart < i18nProviderStart);
    assert.ok(i18nProviderStart < innerBoundaryStart && innerBoundaryStart < suspenseStart);
    assert.ok(suspenseStart < routerProviderStart && routerProviderStart < i18nProviderEnd);
    assert.equal([...app.matchAll(/<AppErrorBoundary>/g)].length, 2);
    assert.match(appErrorBoundary, /static contextType = I18nContext/);
    assert.match(appErrorBoundary, /<Button variant="contained" onClick=\{this\.handleReload\}>[\s\S]{0,100}\{t\?\.\('common\.appErrorReload'\)\}[\s\S]{0,30}<\/Button>/);
    assert.match(app, /role="status"[\s\S]{0,80}aria-live="polite"/);
    const appStyles = await read('src/shared/styles/app.css');
    assert.match(app, /className="app-route-loading"/);
    assert.match(appStyles, /\.app-route-loading[\s\S]*min-height: 100dvh/);
    assert.match(app, /t\('common\.loading'\)/);
    const englishCommon = dictionaries.slice(dictionaries.indexOf('en: {'), dictionaries.indexOf('auth: {'));
    const russianCommonStart = dictionaries.indexOf('common: {', dictionaries.indexOf('ru: {'));
    const russianCommon = dictionaries.slice(russianCommonStart, dictionaries.indexOf('auth: {', russianCommonStart));
    assert.match(englishCommon, /loading: 'Loading…'/);
    assert.match(russianCommon, /loading: 'Загрузка…'/);
    assert.equal([...dictionaries.matchAll(/\| 'common\.loading'/g)].length, 1);
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

  it('preserves page colors and Avatar typography overrides', async () => {
    const inspector = await read('src/components/public-page-builder/InspectorPanel.tsx');
    const blockRenderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    assert.match(inspector, /applyPublicPageThemeColors\(state\.document\.theme, \{ \[color\]: value \}\)/);
    for (const variable of ['--page-section-text', '--theme-heading-color', '--theme-text-color', '--avatar-title-color', '--avatar-bio-color']) {
      assert.match(blockRenderer, new RegExp(`'${variable}': block\\.design\\.textColor`));
    }
    assert.doesNotMatch(blockRenderer, /'--theme-link-(?:title|subtitle)-color': block\.design\.textColor/);
    const avatarBlockStart = blocks.indexOf('export function AvatarBlock');
    const avatarCopyStart = blocks.indexOf('const copy =', avatarBlockStart);
    const avatarCopyEnd = blocks.indexOf("if (layout === 'image-cover')", avatarCopyStart);
    const avatarCopy = blocks.slice(avatarCopyStart, avatarCopyEnd);
    assert.ok(avatarBlockStart > 0 && avatarCopyStart > avatarBlockStart && avatarCopyEnd > avatarCopyStart);
    assert.match(avatarCopy, /component="h1"[\s\S]{0,180}'&&': \{[\s\S]{0,220}fontSize: 'var\(--avatar-title-size\)'[\s\S]{0,220}color: 'var\(--avatar-title-color\)'/);
    assert.match(avatarCopy, /block\.content\.subtitle[\s\S]{0,140}'&&': \{[\s\S]{0,220}fontSize: 'var\(--avatar-bio-size\)'[\s\S]{0,220}color: 'var\(--avatar-bio-color\)'/);

  });

  it('serializes saves and advances the server revision before retrying newer local edits', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const toolbar = await read('src/components/public-page-builder/BuilderToolbar.tsx');

    assert.match(editor, /if \(inFlightSaveRef\.current\)[\s\S]*return inFlightSaveRef\.current/);
    assert.match(editor, /serverRevisionRef\.current = saved\.revision;[\s\S]*localEditRevisionRef\.current !== localRevision[\s\S]*status: 'idle'/);
    assert.match(editor, /finally \{[\s\S]*inFlightSaveRef\.current = null/);
    assert.match(toolbar, /const isBusy = saveStatus === 'saving' \|\| props\.isPublishing \|\| props\.isSlugUnavailable/);
    assert.match(toolbar, /compactAction\(publicPageText\(locale, 'save'\),[\s\S]{0,120}props\.onSave, isBusy\)/);
    assert.match(toolbar, /compactAction\(publicPageText\(locale, 'publish'\),[\s\S]{0,120}props\.onPublish, isBusy\)/);
    assert.equal([...toolbar.matchAll(/disabled=\{isBusy\}/g)].length, 2);
  });

  it('preflights canonical slugs without blocking autosave or stale responses', async () => {
    const repositoryContract = await read('src/features/public-page-builder/repository/PublicPageRepository.ts');
    const apiRepository = await read('src/features/public-page-builder/repository/ApiPublicPageRepository.ts');
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const inspector = await read('src/components/public-page-builder/InspectorPanel.tsx');
    const toolbar = await read('src/components/public-page-builder/BuilderToolbar.tsx');
    const page = await read('src/pages/PublicPageEditorPage.tsx');

    assert.match(repositoryContract, /checkSlugAvailability\(slug: string, pageId\?: string\): Promise<PublicPageSlugAvailability>/);
    assert.match(apiRepository, /new URLSearchParams\(\{ slug \}\)/);
    assert.match(apiRepository, /query\.set\('pageId', pageId\)/);
    assert.match(apiRepository, /\/api\/public-pages\/slug-availability\?\$\{query\.toString\(\)\}/);
    assert.match(apiRepository, /typeof response\.slug !== 'string' \|\| typeof response\.available !== 'boolean'/);
    assert.match(editor, /const canonicalSlug = normalizeSlug\(state\.document\.slug\)/);
    assert.match(editor, /const currentSlugAvailability = useMemo<SlugAvailabilityState>[\s\S]{0,180}validateSlug\(canonicalSlug\) === null[\s\S]{0,180}: \{ status: 'idle', slug: null \}/);
    assert.match(editor, /setSlugAvailability\(\{ status: 'checking', slug: canonicalSlug \}\)/);
    assert.match(editor, /window\.setTimeout\(\(\) => \{[\s\S]{0,180}repository\.checkSlugAvailability\(canonicalSlug, state\.document\.id\)[\s\S]*\}, 450\)/);
    assert.match(editor, /slugAvailabilityRequestRef\.current !== requestId/);
    assert.match(editor, /result\.slug !== canonicalSlug[\s\S]{0,160}status: 'error'/);
    assert.match(editor, /return \(\) => \{[\s\S]{0,120}window\.clearTimeout\(timeout\)[\s\S]{0,180}slugAvailabilityRequestRef\.current \+= 1/);
    assert.match(inspector, /slugAvailability\.slug === canonicalSlug \? slugAvailability\.status : 'idle'/);
    assert.match(inspector, /slugAvailabilityStatus === 'unavailable'/);
    assert.match(inspector, /slugAvailabilityStatus === 'error'[\s\S]{0,120}slugCheckError/);
    assert.match(page, /editor\.slugAvailability\.status === 'unavailable'[\s\S]{0,120}editor\.slugAvailability\.slug === canonicalSlug/);
    assert.match(page, /isSlugUnavailable=\{isSlugUnavailable\}/);
    assert.match(page, /<Button disabled=\{isSlugUnavailable\} onClick=\{\(\) => void editor\.save\(\)\}>/);
    assert.match(toolbar, /props\.isSlugUnavailable/);
    const autosaveGuard = editor.slice(
      editor.lastIndexOf('useEffect(() => {', editor.indexOf("if (conflict !== undefined || !state.dirty")),
      editor.indexOf('const onBeforeUnload'),
    );
    assert.doesNotMatch(autosaveGuard, /slugAvailability|unavailable/);
  });

  it('tracks the published slug baseline and warns until the URL change is published', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const publicPageUrlConfig = await read('src/features/public-page-builder/config/publicPageUrl.ts');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    assert.match(page, /publishedSlug: record\.published\?\.slug \?\? null/);
    assert.match(editor, /initialPublishedSlug \? normalizeSlug\(initialPublishedSlug\) : null/);
    assert.match(editor, /setPublishedSlug\(normalizeSlug\(published\.published\?\.slug \?\? published\.draft\.slug\)\)/);
    assert.match(editor, /setPublishedSlug\(latest\.published \? normalizeSlug\(latest\.published\.slug\) : null\)/);
    assert.match(page, /const publishedSlugChanged = editor\.publishedSlug !== null\s*&& canonicalSlug !== editor\.publishedSlug/);
    assert.match(page, /publishedSlugChangeWarning[\s\S]{0,180}publicPageDisplayUrl\(editor\.publishedSlug\)/);
    assert.match(page, /if \(!editor\.publishedSlug\) \{return;\}[\s\S]{0,120}clipboard\.writeText\(publicPageUrl\(editor\.publishedSlug\)\)/);
    assert.match(page, /\{editor\.publishedSlug \? \([\s\S]*copyLink\(\)[\s\S]*href=\{publicPageUrl\(editor\.publishedSlug\)\}[\s\S]{0,180}rel="noopener noreferrer"/);
    assert.doesNotMatch(page, /publicLinkSlug|editor\.publishedSlug \?\? canonicalSlug/);
    assert.doesNotMatch(page, /https:\/\/meetli\.cc|href=\{`\/\$\{editor\.publishedSlug\}`\}/);
    assert.match(publicPageUrlConfig, /VITE_PUBLIC_PAGE_ORIGIN/);
    assert.match(publicPageUrlConfig, /url\.protocol === 'https:'[\s\S]{0,120}url\.protocol === 'http:'[\s\S]{0,120}isAllowedHttpHost/);
    assert.match(publicPageUrlConfig, /url\.username !== ''[\s\S]{0,260}url\.pathname !== '\/'/);
    assert.match(publicPageUrlConfig, /return `\$\{PUBLIC_PAGE_ORIGIN\}\/\$\{encodeURIComponent\(slug\)\}`/);
    assert.match(page, /state\.saveError === 'slug_conflict'[\s\S]{0,100}'slugConflict'/);
    for (const key of ['slugChecking', 'slugAvailable', 'slugUnavailable', 'slugCheckError', 'publishedSlugChangeWarning', 'slugConflict']) {
      assert.equal([...dictionaries.matchAll(new RegExp(`${key}:`, 'g'))].length, 2);
    }
  });

  it('supports keyboard reorder and focuses the first actionable publish issue', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const validation = await read('src/features/public-page-builder/model/publishValidation.ts');
    const blockDialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const inspector = await read('src/components/public-page-builder/InspectorPanel.tsx');
    const design = await read('src/components/public-page-builder/DesignPanel.tsx');
    const upload = await read('src/components/public-page-builder/ImageUploadControl.tsx');
    const sharedUpload = await read('src/shared/ui/AppImageUpload.tsx');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    assert.equal([...page.matchAll(/aria-keyshortcuts="Alt\+ArrowUp Alt\+ArrowDown"/g)].length, 2);
    assert.match(page, /role="status" aria-live="polite" aria-atomic="true"/);
    assert.match(page, /setReorderAnnouncement\(\(current\) => \(\{ nonce: current\.nonce \+ 1, message \}\)\)/);
    assert.match(page, /<span key=\{reorderAnnouncement\.nonce\}>\{reorderAnnouncement\.message\}<\/span>/);
    assert.match(page, /function resolveEditorReorder\(/);
    assert.match(page, /const reorderEditorItem = useCallback[\s\S]*dispatch\(resolution\.action\)/);
    assert.ok([...page.matchAll(/reorderEditorItem\(\{ type: 'section'/g)].length >= 3);
    assert.ok([...page.matchAll(/reorderEditorItem\(\{ type: 'block'/g)].length >= 3);
    assert.match(page, /if \(!event\.altKey \|\| \(event\.key !== 'ArrowUp' && event\.key !== 'ArrowDown'\)\)[\s\S]{0,120}activator\?\.onKeyDown\?\.\(event\)/);
    assert.match(page, /const issues = await editor\.publish\(\);[\s\S]{0,100}const firstIssue = issues\[0\]/);
    assert.match(page, /resolvePublishIssueFocusTarget\(state\.document, firstIssue\)/);
    assert.match(page, /target\.type === 'page-settings'[\s\S]{0,100}dispatch\(\{ type: 'selection\/clear' \}\);[\s\S]{0,140}setPageSettingsOpen\(true\)/);
    assert.match(page, /scrollIntoView\([\s\S]{0,180}prefers-reduced-motion: reduce[\s\S]{0,120}block: 'center'/);
    assert.match(page, /ref=\{validationAlertRef\} tabIndex=\{-1\}/);
    assert.match(page, /ref=\{addBlockButtonRef\}/);
    assert.match(editor, /reduceEditorActionForMutationTracking\(current, action\)/);
    assert.match(editor, /trackDocumentMutation && reduction\.documentChanged[\s\S]{0,120}localEditRevisionRef\.current \+= 1;[\s\S]{0,80}setPublishIssues\(\[\]\)/);
    assert.match(validation, /export function resolvePublishIssueFocusTarget/);
    assert.match(validation, /issue\.blockId[\s\S]*blocks\\\.\(\[\^\.\]\+\)/);
    assert.match(validation, /mediaOwnerFocusTarget[\s\S]*profile\.logoMediaId[\s\S]*block\.design\.backgroundMediaId/);
    assert.match(validation, /section\.design\.backgroundMediaId[\s\S]*type: 'design-panel'/);
    assert.match(page, /target\.type === 'design-panel'[\s\S]{0,500}setDesignOpen\(true\)/);
    assert.match(design, /focusMarker="theme\.backgroundMediaId"/);
    assert.match(upload, /focusMarker=\{focusMarker\}[\s\S]*altFocusMarker=\{altFocusMarker\}/);
    assert.match(sharedUpload, /altFocusMarker[\s\S]*'data-public-page-focus': altFocusMarker/);
    assert.equal([...sharedUpload.matchAll(/data-public-page-focus=\{focusMarker\}/g)].length, 2);
    assert.doesNotMatch(sharedUpload, /<Stack[^>]*data-public-page-focus=\{focusMarker\}/);
    assert.match(sharedUpload, /<AppButton[\s\S]{0,260}data-public-page-focus=\{focusMarker\}/);
    assert.match(blockDialog, /altFocusMarker=\{mediaId \? `media:\$\{mediaId\}:alt` : undefined\}/);
    assert.match(blockDialog, /data-public-page-editor-tab="content"/);
    assert.match(blockDialog, /data-public-page-focus="block\.content"/);
    assert.match(blockDialog, /data-public-page-focus="section\.design"/);
    for (const marker of ['profile.displayName', 'profile.description', 'seo.title', 'seo.description', 'slug']) {
      assert.match(inspector, new RegExp(`data-public-page-focus': '${marker.replace('.', '\\.')}'`));
    }
    for (const key of ['reorderKeyboardHint', 'sectionReorderLabel', 'blockReorderLabel', 'sectionMovedAnnouncement', 'blockMovedAnnouncement', 'reorderAtStart', 'reorderAtEnd']) {
      assert.equal([...dictionaries.matchAll(new RegExp(`${key}:`, 'g'))].length, 2);
    }
    assert.equal([...page.matchAll(/setBlockEditorFocusRequest\(null\);[\s\S]{0,180}setBlockEditorOpen\(true\)/g)].length, 2);
    assert.match(page, /onFocusTargetMissing=\{\(\) => \{[\s\S]{0,160}setBlockPreview\(null\);[\s\S]{0,100}setBlockEditorFocusRequest\(null\);[\s\S]{0,100}setBlockEditorOpen\(false\)/);
  });

  it('autosaves only after ten seconds without document edits and tracks every mutating layout action', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');

    assert.match(editor, /autosaveMs = 10_000/);
    assert.match(editor, /const timeout = window\.setTimeout\(\(\) => void save\(\), autosaveMs\);[\s\S]*return \(\) => window\.clearTimeout\(timeout\)/);
    assert.match(editor, /\[autosaveMs, conflict, isPublishing, save, state\.dirty, state\.document, state\.saveStatus\]/);
    assert.match(editor, /const candidate = editorReducer\(current, action\)/);
    assert.match(editor, /candidateChangedDocument[\s\S]{0,180}!documentsHaveSameValue\(current\.document, candidate\.document\)/);
    assert.match(editor, /state: candidateChangedDocument && !documentChanged \? current : candidate/);
  });

  it('preserves edits made while publish is in flight and retries them at the returned revision', async () => {
    const editor = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');

    assert.match(editor, /if \(inFlightPublishRef\.current\)[\s\S]*return inFlightPublishRef\.current/);
    assert.match(editor, /const localRevision = localEditRevisionRef\.current;[\s\S]*setIsPublishing\(true\)/);
    assert.match(editor, /serverRevisionRef\.current = published\.revision/);
    assert.match(editor, /!isPublishValidationResultCurrent\(localRevision, localEditRevisionRef\.current\)[\s\S]*status: 'idle'[\s\S]*return \[\]/);
    const publishCatch = editor.slice(editor.indexOf('} catch (error) {', editor.indexOf('const published =')), editor.indexOf('} finally {', editor.indexOf('const published =')));
    const staleGuard = publishCatch.indexOf('!isPublishValidationResultCurrent(localRevision, localEditRevisionRef.current)');
    assert.ok(staleGuard >= 0);
    assert.ok(staleGuard < publishCatch.indexOf('setPublishIssues(issues)'));
    assert.match(publishCatch.slice(staleGuard), /return \[\];[\s\S]*setPublishIssues\(issues\)/);
    assert.match(editor, /if \(conflict !== undefined \|\| !state\.dirty \|\| state\.saveStatus === 'saving' \|\| isPublishing\)/);
    assert.match(editor, /finally \{[\s\S]{0,100}setIsPublishing\(false\)[\s\S]{0,100}\}[\s\S]{0,120}const operation = coreOperation\.finally/);
    assert.match(editor, /const operationGeneration = \+\+publishOperationGenerationRef\.current[\s\S]*coreOperation\.finally\(\(\) => \{[\s\S]{0,180}inFlightPublishRef\.current = null/);
    assert.ok(editor.indexOf('inFlightPublishRef.current = operation') > editor.indexOf('const operation = coreOperation.finally'));
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
    const sharedUpload = await read('src/shared/ui/AppImageUpload.tsx');
    const pageRenderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const blockRenderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');
    const presets = await read('src/features/public-page-builder/config/backgroundPresets.ts');
    const designPanel = await read('src/components/public-page-builder/DesignPanel.tsx');

    assert.match(repository, /post<MediaReference>\('\/api\/public-pages\/media', file/);
    assert.match(repository, /media\/\$\{encodeURIComponent\(mediaId\)\}\/preview/);
    assert.match(upload, /<AppImageUpload<MediaReference>/);
    assert.match(sharedUpload, /5 \* 1024 \* 1024/);
    assert.match(sharedUpload, /image\/jpeg,image\/png,image\/webp/);
    assert.match(sharedUpload, /alt\.trim\(\) \|\| uploaded\.alt\.trim\(\) \|\| defaultAlt\.trim\(\) \|\| label\.trim\(\) \|\| file\.name/);
    assert.match(pageRenderer, /document\.theme\.fontFamily/);
    assert.match(blockRenderer, /backgroundOverlay/);
    assert.ok([...presets.matchAll(/id: '([^']+)'/g)].length >= 10);
    assert.match(designPanel, /activeBackgroundPreset = theme\.backgroundPreset \?\? 'none'/);
    assert.match(designPanel, /PUBLIC_PAGE_BACKGROUND_PRESETS\.map/);
    assert.match(designPanel, /aria-pressed=\{active\}/);
    assert.match(designPanel, /backgroundPreset: preset\.id === 'none' \? null : preset\.id/);
    assert.doesNotMatch(designPanel, /backgroundPreset:[\s\S]{0,160}media\/remove/);
    const customBackgroundControlsStart = designPanel.indexOf('{theme.backgroundMediaId ? <Stack');
    const customBackgroundControlsEnd = designPanel.indexOf('</Stack> : null}', customBackgroundControlsStart);
    assert.ok(customBackgroundControlsStart >= 0 && customBackgroundControlsEnd > customBackgroundControlsStart);
    const customBackgroundControls = designPanel.slice(customBackgroundControlsStart, customBackgroundControlsEnd);
    assert.match(customBackgroundControls, /<TextField select size="small" label=\{publicPageText\(locale, 'imageFit'\)\} value=\{theme\.backgroundFit\}/);
    assert.match(customBackgroundControls, /backgroundFit: event\.target\.value as 'cover' \| 'contain'/);
    assert.match(customBackgroundControls, /<MenuItem value="cover">\{publicPageText\(locale, 'imageFitCover'\)\}<\/MenuItem>/);
    assert.match(customBackgroundControls, /<MenuItem value="contain">\{publicPageText\(locale, 'imageFitContain'\)\}<\/MenuItem>/);
    assert.match(customBackgroundControls, /label=\{publicPageText\(locale, 'focalPoint'\)\} value=\{theme\.backgroundPosition\}/);
    assert.match(customBackgroundControls, /backgroundPosition: event\.target\.value/);
    assert.match(pageRenderer, /backgroundSize: document\.theme\.backgroundFit/);
    assert.match(pageRenderer, /backgroundPosition: document\.theme\.backgroundPosition/);
    assert.match(pageRenderer, /backgroundRepeat: pageBackground \? 'no-repeat' : undefined/);
  });

  it('applies and restores public page SEO metadata for the current slug', async () => {
    const page = await read('src/pages/PublicPageViewPage.tsx');

    assert.match(page, /import \{ normalizeSlug \} from '\.\.\/features\/public-page-builder\/model\/slug'/);
    assert.match(page, /const canonicalRouteSlug = useMemo\(\(\) => normalizeSlug\(slug\), \[slug\]\)/);
    assert.match(page, /repository\.getBySlug\(canonicalRouteSlug\)/);
    assert.match(page, /page\.slug !== canonicalRouteSlug/);
    assert.match(page, /import \{ publicPageUrl \} from '\.\.\/features\/public-page-builder\/config\/publicPageUrl'/);
    assert.match(page, /export function applyPublicPageSeoMetadata\(page: PublicPageDocument\): \(\) => void/);
    assert.match(page, /const canonicalUrl = publicPageUrl\(page\.slug\)/);
    assert.match(page, /document\.title = page\.seo\.title/);
    assert.match(page, /applyMetaTag\('name', 'description', page\.seo\.description\)/);
    assert.match(page, /applyMetaTag\('property', 'og:title', page\.seo\.title\)/);
    assert.match(page, /applyMetaTag\('property', 'og:description', page\.seo\.description\)/);
    assert.match(page, /applyMetaTag\('property', 'og:url', canonicalUrl\)/);
    assert.match(page, /applyMetaTag\('property', 'og:image', imageUrl\)/);
    assert.match(page, /const canonicalSnapshot = applyCanonicalLink\(canonicalUrl\)/);
    assert.match(page, /document\.title = previousTitle/);
    assert.match(page, /snapshots\.forEach\(restoreMetaTag\)/);
    assert.match(page, /restoreCanonicalLink\(canonicalSnapshot\)/);
    assert.match(page, /return applyPublicPageSeoMetadata\(page\)/);
    assert.match(page, /encodeURIComponent\(canonicalRouteSlug\)\}\/booking-options/);
    assert.doesNotMatch(page, /getBySlug\(slug\)|page\.slug !== slug|encodeURIComponent\(slug\)\}\/booking-options/);
  });

  it('deletes detached media only after save and retries published-snapshot conflicts', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');

    assert.match(page, /pendingMediaDeletionIdsRef/);
    assert.match(page, /if \(state\.dirty \|\| state\.saveStatus !== 'saved' \|\| editor\.isPublishing/);
    assert.match(page, /await repository\.deleteMedia\(id\)/);
    assert.match(page, /error\.code === 'media_in_use'/);
    assert.match(page, /URL\.revokeObjectURL\(previewUrl\)/);
    assert.match(page, /pendingMediaDeletionIdsRef\.current\.delete\(id\)/);
    assert.match(page, /const removeBlock[\s\S]*removeDetachedMedia\(collectReferencedMediaIds\(block\)/);
    assert.match(page, /retainedIds\.has\(mediaId\)/);
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

  it('keeps canonical avatar layouts aligned across preview, size, cover, and cover-media cleanup', async () => {
    const dialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const presentation = await read('src/components/public-page-blocks/avatarPresentation.ts');
    const registry = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const variables = await read('src/components/public-page-blocks/publicPageThemeVariables.ts');
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const library = await read('src/components/public-page-builder/AddBlockDialog.tsx');

    assert.match(registry, /type: 'avatar'[\s\S]{0,260}layout: 'centered'[\s\S]{0,100}avatarSize: 150[\s\S]{0,100}coverMediaId: null/);
    assert.match(presentation, /AVATAR_SIZES = \[65, 95, 125, 150\] as const/);
    assert.match(presentation, /AVATAR_LAYOUTS = \['centered', 'cover-centered', 'cover-left', 'image-cover'\] as const/);
    assert.match(presentation, /renderLayout: layout[\s\S]{0,100}layout === 'image-cover' \? null : normalizeAvatarSize/);
    assert.match(blocks, /<AvatarBlock block=\{block\} mediaUrlFor=\{mediaUrlFor\} preview/);
    assert.match(blocks, /normalizeAvatarLayout\(block\.content\.layout\) !== 'image-cover'/);
    assert.match(dialog, /originalAvatarCoverMediaId/);
    assert.match(dialog, /originalAvatarCoverMediaId && originalAvatarCoverMediaId !== avatarCoverMediaId/);
    assert.match(dialog, /avatarCoverControl=\{draft\.type === 'avatar' && theme \? <AvatarCoverPalette/);
    assert.match(dialog, /role="radiogroup" aria-labelledby="avatar-cover-palette-label"/);
    assert.match(dialog, /role="radio" aria-checked=\{selected\}/);
    assert.match(dialog, /tabIndex=\{selected \? 0 : -1\}/);
    assert.match(dialog, /event\.key === 'Home'/);
    assert.match(dialog, /event\.key === 'End'/);
    assert.match(dialog, /event\.key === 'ArrowRight' \|\| event\.key === 'ArrowDown'/);
    assert.match(dialog, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowUp'/);
    assert.match(dialog, /querySelectorAll<HTMLElement>\('\[role="radio"\]'\)[\s\S]{0,80}focus\(\)/);
    assert.match(dialog, /applyAvatarCoverColor\(current\.content, coverColor\)/);
    const avatarCoverControl = dialog.slice(dialog.indexOf('avatarCoverControl='), dialog.indexOf('} /> : null}', dialog.indexOf('avatarCoverControl=')));
    assert.doesNotMatch(avatarCoverControl, /ColorControl|ImageUploadControl|repository/);
    assert.match(dialog, /avatarMediaControl=\{draft\.type === 'avatar' && repository \? <ImageUploadControl/);
    assert.match(dialog, /defaultAlt=\{\(typeof draft\.content\.heading === 'string'/);
    assert.match(dialog, /slotProps=\{\{[\s\S]{0,120}paper: \{ style: resolvePublicPageThemeVariables\(theme, sectionDraft \?\? selectedSection\),/);
    assert.match(dialog, /pending\.find\(\(item\) => item\.media\.id === id\)\?\.objectUrl \?\? previewUrls\?\.get\(id\) \?\? media\.find/);
    assert.match(blocks, /preview \? AVATAR_EDITOR_PLACEHOLDER_URL : ''/);
    assert.match(blocks, /data-avatar-preview-stage[\s\S]{0,120}height: 300[\s\S]{0,120}overflow: 'hidden'/);
    assert.match(blocks, /data-avatar-preview-stage[\s\S]{0,500}'&::after'[\s\S]{0,180}linear-gradient/);
    assert.match(blocks, /data-avatar-preview-device[\s\S]{0,180}width: AVATAR_PREVIEW_REFERENCE\.deviceWidth[\s\S]{0,360}borderRadius: '33px 33px 0 0'/);
    assert.match(blocks, /boxShadow: '0 7px 28px 7px rgba\(0,0,0,\.1\)'/);
    assert.match(blocks, /data-avatar-preview-screen[\s\S]{0,160}width: AVATAR_PREVIEW_REFERENCE\.screenWidth[\s\S]{0,360}borderRadius: '25px 25px 0 0'/);
    assert.match(blocks, /AVATAR_PREVIEW_REFERENCE\.sectionPadding[\s\S]{0,220}'--avatar-leading-section-radius': '25px'/);
    const previewDevice = blocks.slice(blocks.indexOf('<Box data-avatar-preview-device'), blocks.indexOf('</Box>', blocks.indexOf('<Box data-avatar-preview-screen')));
    assert.doesNotMatch(previewDevice, /(?:min)?height:/);
    assert.match(presentation, /AVATAR_COVER_REFERENCE = \{[\s\S]{0,180}height: 112\.5[\s\S]{0,100}avatarCenterX: 187\.5[\s\S]{0,100}avatarOffsetX: 28/);
    assert.match(presentation, /resolveLeadingAvatarSectionMarginTop[\s\S]{0,260}blockType !== 'avatar'[\s\S]{0,120}blockIndex !== 0[\s\S]{0,360}innerTopBleed - paddingTop/);
    assert.match(renderer, /mt: editor \? 0 : `\$\{resolveLeadingAvatarSectionMarginTop\(block\.type, blockIndex, section\.design\.paddingTop, isOff, block\.content\.layout\)\}px`/);
    assert.match(renderer, /public-page-dnd-block-wrapper[\s\S]{0,260}mt: `\$\{resolveLeadingAvatarSectionMarginTop\(block\.type, blockIndex, section\.design\.paddingTop, isOff, block\.content\.layout\)\}px`/);
    assert.doesNotMatch(renderer, /(?:ml|mr|mx|marginLeft|marginRight):[^\n]*resolveLeadingAvatarSectionMarginTop/);
    assert.match(renderer, /const sectionRadius = sectionSurfaceRadius\([\s\S]{0,120}section\.design\.borderRadius[\s\S]{0,120}theme\.styleDefaults\.sectionBorderRadius/);
    assert.match(renderer, /leadingAvatarSectionRadius[\s\S]{0,180}!isOff && block\.type === 'avatar' && blockIndex === 0 \? sectionRadius : '0px'/);
    assert.match(renderer, /!editor \? \{ '--avatar-leading-section-radius': leadingAvatarSectionRadius\(block, blockIndex\) \} : \{\}/);
    const dndAvatarWrapper = renderer.slice(renderer.indexOf('public-page-dnd-block-wrapper'), renderer.indexOf('<Box className="public-page-dnd-block-shell">'));
    assert.match(dndAvatarWrapper, /\.\.\.blockThemeSx,[\s\S]{0,100}'--avatar-leading-section-radius': leadingAvatarSectionRadius\(block, blockIndex\)/);
    assert.doesNotMatch(renderer, /overflow: 'hidden'/);
    assert.match(presentation, /avatarTop: AVATAR_COVER_REFERENCE\.height - avatarSize[\s\S]{0,160}avatarTranslateY: avatarSize \/ 2/);
    const coverLeftStart = blocks.indexOf("if (layout === 'cover-left')");
    const coverLeftRenderer = blocks.slice(coverLeftStart, blocks.indexOf("if (layout === 'cover-centered')", coverLeftStart));
    assert.doesNotMatch(coverLeftRenderer, /(?:min)?height: AVATAR_.*(?:content|screen|device)/);
    assert.doesNotMatch(coverLeftRenderer, /preview \?/);
    assert.match(coverLeftRenderer, /<Box className="public-page-avatar-cover-bleed" sx=\{coverSx\}>[\s\S]{0,240}component="img"/);
    assert.match(coverLeftRenderer, /transform: `translate\(\$\{geometry\.avatarTranslateX\}px, \$\{geometry\.avatarTranslateY\}px\)`/);
    assert.match(coverLeftRenderer, /width: `calc\(100% - \$\{geometry\.copyMarginLeft\}px\)`[\s\S]{0,160}copyMarginLeft[\s\S]{0,120}textAlign: 'left'/);
    assert.match(presentation, /AVATAR_HERO_REFERENCE = \{[\s\S]{0,100}imageWidth: 375[\s\S]{0,100}imageHeight: 262\.5/);
    const imageCoverStart = blocks.indexOf("if (layout === 'image-cover')", blocks.indexOf('export function AvatarBlock'));
    const imageCoverRenderer = blocks.slice(imageCoverStart, blocks.indexOf("const avatarSize =", imageCoverStart));
    assert.match(imageCoverRenderer, /className="public-page-avatar-cover-bleed"[\s\S]{0,220}height: AVATAR_HERO_REFERENCE\.imageHeight/);
    assert.match(imageCoverRenderer, /borderRadius: 'var\(--avatar-leading-section-radius\) var\(--avatar-leading-section-radius\) 0 0'/);
    assert.match(imageCoverRenderer, /backgroundImage: imageUrl \? `url\("\$\{imageUrl\}"\)` : undefined/);
    assert.match(imageCoverRenderer, /const imageAlt = text\(block\.content\.imageAlt\)\.trim\(\)/);
    assert.match(imageCoverRenderer, /role=\{imageUrl && imageAlt \? 'img' : undefined\}/);
    assert.match(imageCoverRenderer, /copyMarginTop[\s\S]{0,100}textAlign: 'center'/);
    assert.doesNotMatch(imageCoverRenderer, /linear-gradient|MaskImage|component="img"/);
    const centeredStart = blocks.indexOf("if (layout === 'centered')", blocks.indexOf('export function AvatarBlock'));
    const centeredRenderer = blocks.slice(centeredStart, blocks.indexOf("const coverSx =", centeredStart));
    assert.match(centeredRenderer, /height: avatarSize[\s\S]{0,100}display: 'grid'[\s\S]{0,80}placeItems: 'center'/);
    assert.match(centeredRenderer, /copyMarginTop/);
    assert.doesNotMatch(centeredRenderer, /minHeight|contentMinHeight/);
    assert.doesNotMatch(centeredRenderer, /preview \?/);
    const coverCenteredStart = blocks.indexOf("if (layout === 'cover-centered')", blocks.indexOf('export function AvatarBlock'));
    const coverCenteredRenderer = blocks.slice(coverCenteredStart, blocks.indexOf('return null;', coverCenteredStart));
    assert.match(coverCenteredRenderer, /resolveAvatarCoverCenteredGeometry\(avatarSize\)/);
    assert.match(coverCenteredRenderer, /<Box className="public-page-avatar-cover-bleed" sx=\{coverSx\}>[\s\S]{0,240}component="img"/);
    assert.match(coverCenteredRenderer, /left: '50%'[\s\S]{0,160}geometry\.avatarTranslateX/);
    assert.doesNotMatch(coverCenteredRenderer, /preview \?|(?:min)?height: AVATAR_.*(?:content|screen|device)/);
    assert.match(blocks.slice(blocks.indexOf('const coverSx ='), coverCenteredStart), /borderRadius: 'var\(--avatar-leading-section-radius\) var\(--avatar-leading-section-radius\) 0 0'/);
    assert.match(variables, /'--avatar-cover-background': options\.coverColor\?\.trim\(\) \|\| theme\.colors\.primary/);
    assert.match(variables, /'--avatar-title-font-family': title\.fontFamily/);
    assert.match(page, /<AddBlockDialog[\s\S]{0,180}theme=\{state\.document\.theme\}/);
    assert.match(page, /<BlockEditorDialog[\s\S]{0,500}theme=\{state\.document\.theme\}/);
    assert.match(library, /<BlockEditorDialog[\s\S]{0,180}theme=\{theme\}/);
    assert.match(library, /repository=\{repository\} media=\{media\} previewUrls=\{previewUrls\}/);
    assert.match(library, /onSave=\{\(result\) => \{ onConfirm\(result\); close\(\); \}\}/);
    assert.match(page, /<AddBlockDialog[\s\S]{0,300}repository=\{repository\} media=\{state\.document\.media\} previewUrls=\{mediaUrls\}/);
    const addBlockFlow = page.slice(page.indexOf('const addBlock ='), page.indexOf('const removeDetachedMedia'));
    assert.match(addBlockFlow, /const mediaChanges = \{ upsert:/);
    assert.match(addBlockFlow, /type: 'block\/add'[\s\S]*mediaChanges/);
    assert.match(addBlockFlow, /type: 'block\/create-with-section'[\s\S]*mediaChanges/);
    assert.match(addBlockFlow, /rememberMediaPreview\(media, objectUrl\)/);
    assert.match(blocks, /resolveAvatarSizeChange\(block\.content\.layout, size\)/);
    assert.match(blocks, /resolveAvatarSizeChange\(block\.content\.layout, nextSize\)/);
    assert.doesNotMatch(registry, /avatar-default\.svg/);
  });

  it('uses one section surface and exposes shared section design in the block editor', async () => {
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const blockRenderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const dialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const sectionControls = await read('src/components/public-page-builder/SectionDesignControls.tsx');
    const colorControl = await read('src/components/public-page-builder/ColorControl.tsx');
    const library = await read('src/components/public-page-builder/AddBlockDialog.tsx');
    const templates = await read('src/features/public-page-builder/templates/index.ts');

    assert.match(renderer, /section\.design\.backgroundColor/);
    assert.match(renderer, /pt: isOff \? 0 : `\$\{section\.design\.paddingTop\}px`/);
    assert.match(renderer, /pb: isOff \? 0 : `\$\{section\.design\.paddingBottom\}px`/);
    assert.match(renderer, /const SECTION_HORIZONTAL_SPACING_PX = 14/);
    assert.match(renderer, /pl: isOff \? 0 : `calc\(\$\{SECTION_HORIZONTAL_SPACING_PX\}px \+ \$\{borderWidth\}px\)`/);
    assert.match(renderer, /boxSizing: 'border-box'/);
    assert.match(renderer, /const sectionInlineMargin = section\.design\.horizontalMargin \? `\$\{SECTION_HORIZONTAL_SPACING_PX\}px` : '0px'/);
    assert.doesNotMatch(renderer, /PUBLIC_PAGE_DND_SECTION_INSET|public-page-section-block-inset/);
    assert.doesNotMatch(renderer, /1rem/);
    assert.match(renderer, /\? `min\(calc\(100% - \$\{sectionInlineMargin\} - \$\{sectionInlineMargin\}\), 720px\)`[\s\S]{0,80}: 'auto'/);
    assert.match(renderer, /ml: section\.design\.width === 'contained' \? 'auto' : sectionInlineMargin/);
    assert.match(renderer, /mr: section\.design\.width === 'contained' \? 'auto' : sectionInlineMargin/);
    const editorBlockWrapper = renderer.slice(renderer.indexOf('const renderBlock ='), renderer.indexOf('return (', renderer.indexOf('const renderBlock =')));
    assert.doesNotMatch(editorBlockWrapper, /borderRadius/);
    assert.match(renderer, /borderRadius: isOff[\s\S]{0,30}\? 0[\s\S]{0,50}: sectionRadius/);
    assert.match(renderer, /section\.design\.borderRadius/);
    assert.match(renderer, /sectionSurfaceRadius\([\s\S]{0,140}theme\.styleDefaults\.sectionBorderRadius/);
    const canonicalRadius = blockRenderer.slice(blockRenderer.indexOf('export function sectionThemeRadius'), blockRenderer.indexOf('export function sectionSurfaceRadius'));
    assert.match(canonicalRadius, /return `\$\{roundedRadius\}px`/);
    assert.doesNotMatch(canonicalRadius, /'pill'|'square'/);
    assert.match(renderer, /\.\.\.resolvePublicPageThemeVariables\(theme, section\)/);
    const rendererWrapper = blockRenderer.slice(blockRenderer.indexOf('return <Box sx='), blockRenderer.indexOf('<BlockErrorBoundary'));
    assert.match(blockRenderer, /blockSurfaceRadius\(block\.design\.borderRadius, roundingStyle, themeBorderRadius\)/);
    assert.match(rendererWrapper, /hasSurface[\s\S]*borderRadius: hasSurface \? surfaceRadius : undefined[\s\S]*overflow: hasSurface/);
    assert.match(rendererWrapper, /pt: `\$\{block\.design\.paddingTop \?\? 0\}px`/);
    assert.match(rendererWrapper, /bgcolor: hasSurface \? block\.design\.backgroundColor/);
    const buttonBlock = blocks.slice(blocks.indexOf('export function ButtonBlock'), blocks.indexOf('export function LinksBlock'));
    assert.match(blocks, /ordinaryPublicPageLinkSx =[\s\S]{0,900}borderRadius: 'var\(--theme-link-border-radius\)'/);
    assert.match(buttonBlock, /\.\.\.ordinaryPublicPageLinkSx/);
    assert.doesNotMatch(blocks, /block\.content\.radius/);
    const surface = (await read('src/components/public-page-blocks/blocks.tsx')).slice(
      (await read('src/components/public-page-blocks/blocks.tsx')).indexOf('function Surface'),
      (await read('src/components/public-page-blocks/blocks.tsx')).indexOf('function hrefFor'),
    );
    assert.doesNotMatch(surface, /borderRadius|bgcolor|p:/);
    const blockSettings = dialog.slice(dialog.indexOf('{tab === 1'), dialog.indexOf('{tab === 2'));
    assert.doesNotMatch(blockSettings, /draft\.design\.borderRadius|label=\{publicPageText\(locale, 'borderRadius'\)\}/);
    const sectionSettings = dialog.slice(dialog.indexOf('{tab === 3'), dialog.indexOf('</DialogContent>'));
    assert.match(sectionSettings, /<SectionDesignControls/);
    for (const group of ['general', 'background', 'text', 'links']) {
      assert.match(sectionControls, new RegExp(`data-section-settings-group="${group}"`));
    }
    assert.match(sectionControls, /SECTION_SPACING_STEP_PX = 14/);
    assert.match(sectionControls, /SECTION_SPACING_MAX_STEP = 5/);
    assert.match(sectionControls, /disabled=\{isOff\}/);
    assert.match(sectionControls, /!isOff \? <NumberStepper[^>]*borderRadius/);
    assert.match(sectionControls, /const displayValue = value \?\? inheritedValue \?\? minimum/);
    assert.match(sectionControls, /<TextField size="small" value=\{displayValue\}/);
    assert.match(sectionControls, /changeBy = \(delta: number\) => onChange\(clamp\(displayValue \+ delta/);
    assert.match(sectionControls, /const effectiveFamily = value\.fontFamily \?\? resolvedValue\.fontFamily \?\? ''/);
    assert.match(sectionControls, /const effectiveSize = value\.fontSize \?\? resolvedValue\.fontSize/);
    assert.match(sectionControls, /const effectiveWeight = value\.fontWeight \?\? resolvedValue\.fontWeight/);
    assert.match(sectionControls, /TYPOGRAPHY_FONT_OPTIONS/);
    assert.match(sectionControls, /<ColorControl label=\{publicPageText\(locale, 'textColor'\)\} value=\{value\.color\}/);
    assert.match(sectionControls, /gridTemplateColumns: \{ xs: 'minmax\(0, 1fr\)', sm: 'repeat\(2, minmax\(0, 1fr\)\)' \}/);
    assert.match(sectionControls, /resolvedValue=\{resolvedHeadingStyle\}/);
    assert.match(sectionControls, /resolvedValue=\{resolvedLinkTitleStyle\}/);
    assert.match(sectionControls, /resolvePublicPageThemeVariables\(theme, section\)/);
    assert.match(colorControl, /const displayValue = props\.value \?\? props\.resolvedValue \?\? ''/);
    assert.match(colorControl, /value=\{displayValue\}/);
    assert.match(sectionControls, /onReset=\{\(\) => updateDesign\(\{ borderRadius: null \}\)\}/);
    assert.match(sectionControls, /onReset=\{\(\) => updateLinkStyle\(\{ borderWidth: null \}\)\}/);
    assert.match(sectionControls, /onClick=\{\(\) => onChange\(\{ fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null \}\)\}/);
    assert.match(sectionControls, /Tooltip title=\{publicPageText\(locale, 'inherit'\)\}/);
    const sectionBorderStepper = sectionControls.slice(
      sectionControls.indexOf("label={publicPageText(locale, 'borderWidth')}", sectionControls.indexOf('data-section-settings-group="general"')),
      sectionControls.indexOf('data-section-settings-group="background"'),
    );
    assert.doesNotMatch(sectionBorderStepper, /onReset=/);
    for (const removedField of ['backgroundOverlay', 'backgroundFit', 'backgroundPosition', 'mobileVisible', 'sectionWidth']) {
      assert.doesNotMatch(sectionControls, new RegExp(removedField));
    }
    assert.match(renderer, /borderWidth: `\$\{borderWidth\}px`/);
    assert.match(renderer, /borderColor: isOff \? 'transparent' : section\.design\.borderColor \?\? 'transparent'/);
    assert.match(dialog, /tabContent[\s\S]*tabSettings[\s\S]*tabSection/);
    for (const field of ['paddingTop', 'paddingBottom', 'horizontalMargin', 'borderWidth', 'borderColor']) {
      assert.match(sectionControls, new RegExp(field));
    }
    assert.match(library, /filter\(\(\{ type \}\) => type !== 'social-button'\)/);
    assert.doesNotMatch(templates, /block\(`\$\{id\}-hero`/);
    assert.match(templates, /block\(`\$\{id\}-avatar`, 'avatar'/);
    assert.match(templates, /block\(`\$\{id\}-button`, 'button'/);
    assert.match(templates, /sections: blocks\.map/);
    for (const variant of ['sectionOff', 'newSection', 'sectionsFromDesign', 'primarySection', 'secondarySection']) {
      assert.match(dialog, new RegExp(variant));
    }
    assert.doesNotMatch(dialog, /CREATE_NEW_SECTION_VALUE|createNewSection/);
  });

  it('appends new blocks directly and keeps moves in single reducer commits', async () => {
    const actions = await read('src/features/public-page-builder/types/actions.ts');
    const reducer = await read('src/features/public-page-builder/model/editorReducer.ts');
    const page = await read('src/pages/PublicPageEditorPage.tsx');

    assert.match(actions, /block\/create-with-section/);
    assert.match(actions, /block\/move-or-detach/);
    assert.match(reducer, /case 'block\/create-with-section'/);
    assert.match(reducer, /case 'block\/move-or-detach'/);
    assert.match(actions, /block\/add'[\s\S]{0,160}mediaChanges\?: BlockMediaChanges/);
    assert.match(actions, /block\/create-with-section'[\s\S]{0,160}mediaChanges\?: BlockMediaChanges/);
    assert.match(reducer, /function applyBlockMediaChanges[\s\S]{0,700}documentReferencesMedia/);
    assert.match(reducer, /case 'block\/add'[\s\S]{0,500}applyBlockMediaChanges/);
    assert.match(reducer, /case 'block\/create-with-section'[\s\S]{0,700}applyBlockMediaChanges/);
    assert.match(reducer, /function removeBlockFromSource/);
    assert.match(reducer, /blocks: section\.blocks\.filter\(\(block\) => block\.id !== blockId\)/);
    assert.match(reducer, /function removeBlockAndPruneSource/);
    assert.match(reducer, /source\.blocks\.length === 1[\s\S]{0,120}source\.design\.variant !== 'off'[\s\S]{0,120}destination\.design\.variant === 'off'/);
    assert.match(reducer, /destination\.blocks\.slice\(0, destinationBlockIndex\)[\s\S]{0,240}splitSectionId\(document\.sections, destination\.id, source\.id\)[\s\S]{0,160}destination\.blocks\.slice\(destinationBlockIndex\)/);
    assert.match(page, /const targetSection = state\.document\.sections\[state\.document\.sections\.length - 1\]/);
    assert.match(page, /type: 'block\/add', sectionId: targetSection\.id, block, index: targetSection\.blocks\.length/);
    assert.match(page, /type: 'selection\/set', sectionId: targetSection\.id, blockId: block\.id/);
    assert.match(page, /createEmptyPageSection\('off'\)[\s\S]{0,100}section\.blocks = \[block\][\s\S]{0,100}type: 'block\/create-with-section'/);
    assert.match(page, /pendingScrollBlockIdRef\.current = block\.id/);
    assert.match(page, /requestAnimationFrame\(\(\) => target\.scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)\)/);
    assert.match(page, /type: 'layout\/drop'/);
    assert.match(page, /type: 'block\/move-or-detach'/);
  });

  it('uses direct smooth-dnd containers with one atomic drop and visible handles', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const sortableBuilder = await read('src/components/public-page-builder/BuilderSortable.tsx');
    const dndCss = await read('src/components/public-page-builder/publicPageDnd.css');
    const blockEditor = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const editorHook = await read('src/features/public-page-builder/hooks/usePublicPageEditor.ts');
    const responsivePreview = await read('src/components/public-page-builder/ResponsivePreview.tsx');
    assert.match(sortableBuilder, /from 'smooth-dnd'/);
    assert.match(sortableBuilder, /smoothDnD\.dropHandler = dropHandlers\.reactDropHandler\(\)\.handler/);
    assert.match(sortableBuilder, /smoothDnD\.wrapChild = false/);
    assert.match(sortableBuilder, /useLayoutEffect/);
    assert.match(sortableBuilder, /onDrop: \(result\) => \{[\s\S]{0,100}optionsRef\.current\.onDrop\(result\)/);
    assert.match(sortableBuilder, /disposed = true;[\s\S]{0,80}instance\.dispose\(\)/);
    assert.match(sortableBuilder, /getGhostParent: \(\) => document\.body/);
    assert.doesNotMatch(sortableBuilder, /PUBLIC_PAGE_THEME_VARIABLE_NAMES|style\.setProperty/);
    assert.deepEqual([...sortableBuilder.matchAll(/ghost\.style\.([A-Za-z]+)/g)].map((match) => match[1]), ['marginLeft', 'width']);
    assert.match(sortableBuilder, /PUBLIC_PAGE_DND_CONTEXT_ATTRIBUTE = 'data-public-page-dnd-context'/);
    assert.match(sortableBuilder, /ghost\.setAttribute\(PUBLIC_PAGE_DND_CONTEXT_ATTRIBUTE, context\)/);
    assert.match(sortableBuilder, /PUBLIC_PAGE_DND_CHROME_SELECTOR[\s\S]{0,300}public-page-block-actions[\s\S]{0,300}public-page-section-actions/);
    assert.match(sortableBuilder, /ghost\.querySelectorAll\(PUBLIC_PAGE_DND_CHROME_SELECTOR\)\.forEach\(\(element\) => element\.remove\(\)\)/);
    assert.match(sortableBuilder, /onDragStart: \(params\) => \{[\s\S]{0,300}params\.isSource[\s\S]{0,300}queueMicrotask[\s\S]{0,300}syncGhostWithTarget\(element\)/);
    assert.match(sortableBuilder, /onDragEnter: \(\) => \{[\s\S]{0,180}syncGhostWithTarget\(element\)/);
    assert.match(sortableBuilder, /SMOOTH_DND_WRAPPER_CLASS = constants\.wrapperClass/);
    assert.match(renderer, /useSmoothDndContainer\(mainContainerRef/);
    assert.match(renderer, /useSmoothDndContainer\(blockContainerRef/);
    assert.match(renderer, /payload\.type !== 'section'/);
    assert.match(renderer, /data-public-page-main-container/);
    assert.match(renderer, /data-public-page-block-container=\{section\.id\}/);
    assert.match(renderer, /data-public-page-dnd-context=\{isOff \? 'page' : 'section'\}/);
    assert.match(renderer, /data-public-page-main-container data-public-page-dnd-context="page"/);
    assert.match(renderer, /public-page-dnd-wrapper public-page-dnd-block-wrapper/);
    const mainContainerCss = dndCss.slice(dndCss.indexOf('.public-page-dnd-main-container {'), dndCss.indexOf('.public-page-dnd-section-shell'));
    assert.match(mainContainerCss, /flex: 0 0 auto/);
    assert.match(mainContainerCss, /min-height: 52px/);
    assert.doesNotMatch(mainContainerCss, /flex:\s*1/);
    assert.match(page, /const onDropItem = \(payload: BuilderDragPayload, destination: BuilderDropDestination\)/);
    assert.match(page, /type: 'layout\/drop'/);
    assert.match(editorHook, /reduceEditorActionForMutationTracking\(current, action\)/);
    assert.match(editorHook, /const editorDispatch = useCallback[\s\S]{0,140}applyAction\(action, true\)/);
    assert.match(blockEditor, /if \(!open \|\| !block\) \{return null;\}/);
    assert.doesNotMatch(page + renderer + sortableBuilder, /@dnd-kit|DndContext|SortableContext|DragOverlay|useSortable|useDraggable/);
    assert.doesNotMatch(page, /dragPreviewDocument|activeDrag|onDndOver|collisionDetection/);
    assert.doesNotMatch(renderer, /PublicPageDragPreview|chromeFreeBlockPreview/);
    assert.match(renderer, /const heading = isOff \? theme\.styleDefaults\.headingStyle :/);
    assert.match(renderer, /resolvePublicPageThemeVariables\(theme, section\)/);
    assert.match(page, /renderBlockDragHandle:[\s\S]*className="public-page-block-drag-rail"/);
    const blockHandleCss = dndCss.slice(dndCss.indexOf('.MuiIconButton-root.public-page-block-drag-rail {'), dndCss.indexOf('.MuiIconButton-root.public-page-block-drag-rail:hover'));
    assert.match(blockHandleCss, /top: 50%/);
    assert.match(blockHandleCss, /var\(--public-page-editor-drag-gutter\)/);
    assert.match(blockHandleCss, /width: 36px[\s\S]*height: 100%/);
    assert.match(sortableBuilder, /return type === 'section' \|\| type === 'block';/);
    assert.match(dndCss, /\.smooth-dnd-container\.vertical > \.smooth-dnd-draggable-wrapper\.public-page-dnd-wrapper \{[\s\S]{0,80}overflow: visible/);
    assert.doesNotMatch(page.slice(page.indexOf('className="public-page-block-drag-rail"'), page.indexOf('<DragIndicator fontSize="small" /></IconButton>;', page.indexOf('className="public-page-block-drag-rail"'))), /minHeight/);
    const sectionDragHandle = page.slice(page.indexOf('renderSectionDragHandle:'), page.indexOf('renderBlockDragHandle:'));
    assert.match(sectionDragHandle, /if \(section\.design\.variant === 'off'\) \{return null;\}/);
    assert.ok(sectionDragHandle.indexOf("section.design.variant === 'off'") < sectionDragHandle.indexOf('public-page-section-drag-rail'));
    assert.match(sectionDragHandle, /return <IconButton[\s\S]*title=\{publicPageText\(locale, 'drag'\)\}[\s\S]*public-page-section-drag-rail/);
    assert.doesNotMatch(sectionDragHandle, /Tooltip/);
    const blockDragHandle = page.slice(page.indexOf('renderBlockDragHandle:'), page.indexOf('}} />', page.indexOf('renderBlockDragHandle:')));
    assert.match(blockDragHandle, /return <IconButton[\s\S]*title=\{publicPageText\(locale, 'drag'\)\}/);
    assert.doesNotMatch(blockDragHandle, /Tooltip/);
    assert.match(page, /const action = [^\n]+<Tooltip title=\{label\}>/);
    const sectionHandleCss = dndCss.slice(dndCss.indexOf('.MuiIconButton-root.public-page-section-drag-rail {'), dndCss.indexOf('.MuiIconButton-root.public-page-section-drag-rail:hover'));
    assert.match(sectionHandleCss, /top: 0[\s\S]*left: 50%/);
    assert.match(sectionHandleCss, /width: 48px[\s\S]*height: 24px/);
    assert.match(sectionHandleCss, /translate\(-50%, -50%\)/);
    assert.match(renderer, /data-public-page-section-drag-target=\{editor \? section\.id : undefined\}/);
    assert.doesNotMatch(renderer, /'&::after'/);
    assert.match(page, /sectionResizePreview/);
    assert.match(page, /resizeSectionMembership\(document, sectionResizePreview\.sectionId, sectionResizePreview\.targetBlockCount\)/);
    assert.match(page, /renderSectionResizeHandle:/);
    assert.match(page, /role="slider"[\s\S]{0,200}aria-orientation="vertical"[\s\S]{0,200}aria-valuemin=\{1\}[\s\S]{0,200}aria-valuemax=\{maximumBlockCount\}[\s\S]{0,200}aria-valuenow=\{currentBlockCount\}/);
    const resizeKeyboard = page.slice(page.indexOf("case 'ArrowUp':", page.indexOf('renderSectionResizeHandle:')), page.indexOf('event.preventDefault()', page.indexOf("case 'ArrowUp':", page.indexOf('renderSectionResizeHandle:'))));
    assert.match(resizeKeyboard, /case 'ArrowUp':[\s\S]*case 'ArrowRight':[\s\S]*currentBlockCount \+ 1/);
    assert.match(resizeKeyboard, /case 'ArrowDown':[\s\S]*case 'ArrowLeft':[\s\S]*currentBlockCount - 1/);
    assert.match(resizeKeyboard, /case 'Home':[\s\S]*targetBlockCount = 1/);
    assert.match(resizeKeyboard, /case 'End':[\s\S]*targetBlockCount = maximumBlockCount/);
    assert.match(page, /window\.addEventListener\('pointermove', onPointerMove\)[\s\S]{0,400}window\.addEventListener\('pointerup', onPointerUp\)/);
    assert.match(page, /window\.addEventListener\('pointercancel', onPointerCancel\)/);
    assert.match(page, /window\.addEventListener\('blur', onCancel\)/);
    assert.match(page, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
    assert.match(page, /setSectionResizePreview[\s\S]{0,1000}dispatch\(\{ type: 'section\/resize-membership'/);
    const resizeGesture = page.slice(page.indexOf('const beginSectionResize ='), page.indexOf('\n\n  return (', page.indexOf('const beginSectionResize =')));
    assert.match(responsivePreview, /<PreviewScroller data-public-page-preview-scroller/);
    assert.match(resizeGesture, /querySelector<HTMLElement>\('\[data-public-page-preview-scroller\]'\)/);
    const countAt = resizeGesture.slice(resizeGesture.indexOf('const countAt ='), resizeGesture.indexOf('const updateTargetCount ='));
    assert.match(countAt, /candidateBlockIds\.map[\s\S]*querySelector<HTMLElement>[\s\S]*getBoundingClientRect\(\)/);
    assert.doesNotMatch(resizeGesture.slice(0, resizeGesture.indexOf('const countAt =')), /const midpoints/);
    const autoScroll = resizeGesture.slice(resizeGesture.indexOf('const runAutoScroll ='), resizeGesture.indexOf('const cleanup ='));
    assert.match(autoScroll, /previewScroller\.getBoundingClientRect\(\)[\s\S]*scrollDelta[\s\S]*previewScroller\.scrollTop \+= scrollDelta/);
    assert.match(autoScroll, /window\.requestAnimationFrame\(runAutoScroll\)/);
    const resizeCleanup = resizeGesture.slice(resizeGesture.indexOf('const cleanup ='), resizeGesture.indexOf('const onPointerMove ='));
    for (const listener of ['pointermove', 'pointerup', 'pointercancel', 'blur']) {
      assert.match(resizeCleanup, new RegExp(`window\\.removeEventListener\\('${listener}'`));
    }
    assert.match(resizeCleanup, /document\.removeEventListener\('visibilitychange', onVisibilityChange\)/);
    assert.match(resizeCleanup, /window\.cancelAnimationFrame\(autoScrollFrame\)/);
    const pointerUp = resizeGesture.slice(resizeGesture.indexOf('const onPointerUp ='), resizeGesture.indexOf('const onPointerCancel ='));
    assert.equal((pointerUp.match(/dispatch\(\{ type: 'section\/resize-membership'/g) ?? []).length, 1);
    assert.match(pointerUp, /cleanup\(\);[\s\S]*dispatch\(\{ type: 'section\/resize-membership'/);
    const cancelStart = resizeGesture.indexOf('const onPointerCancel =');
    const cancelPaths = resizeGesture.slice(cancelStart, resizeGesture.indexOf('sectionResizeGestureRef.current = { cancel: cleanup }', cancelStart));
    assert.match(cancelPaths, /onPointerCancel[\s\S]*cleanup\(\)/);
    assert.match(cancelPaths, /onCancel = \(\) => cleanup\(\)/);
    assert.match(cancelPaths, /document\.hidden[\s\S]*cleanup\(\)/);
    assert.doesNotMatch(cancelPaths, /dispatch\(\{ type: 'section\/resize-membership'/);
    assert.match(renderer, /renderSectionResizeHandle\?/);
    assert.match(renderer, /editor && !isOff && section\.blocks\.length > 0/);
    assert.match(dndCss, /public-page-section-resize-handle/);
    const sectionHighlightCss = dndCss.slice(dndCss.indexOf('.public-page-dnd-section-shell:has(> .public-page-section-drag-rail:hover)'), dndCss.indexOf('.public-page-dnd-block-container'));
    assert.match(sectionHighlightCss, /public-page-section-drag-rail:hover/);
    assert.match(sectionHighlightCss, /public-page-section-drag-rail:focus-visible/);
    assert.match(sectionHighlightCss, /pointer-events: none/);
    assert.doesNotMatch(page + renderer, /dragPreviewDocument|activeDrag|onDndOver|collisionDetection|PublicPageDragPreview|chromeFreeBlockPreview/);
    assert.match(renderer, /document\.sections\.map\(\(section, sectionIndex\) => \([\s\S]{0,500}data-public-page-sortable="section"/);
    assert.match(renderer, /shouldAcceptDrop: \(_source, payload\) => isBuilderDragPayload\(payload\),/);
    assert.match(dndCss, /gap: max\(var\(--theme-link-offset\), var\(--public-page-main-drop-space\)\)/);
    assert.match(dndCss, /padding-block: var\(--public-page-main-drop-space\)/);
    assert.doesNotMatch(renderer, /MainRenderItem|mainItems|free-block|data-public-page-free-block/);
    assert.doesNotMatch(renderer, /dropPlaceholder/);
    assert.match(renderer, /shouldAnimateDrop: \(\) => false/);
    assert.match(renderer, /\.\.\.blockThemeSx/);
    assert.match(renderer, /ordinaryPublicPageLinkSx/);
    assert.match(blocks, /export const ordinaryPublicPageLinkSx/);
    assert.match(blocks, /export function CtaButton[\s\S]{0,500}sx=\{\{ \.\.\.ordinaryPublicPageLinkSx/);
    const buttonBlock = blocks.slice(blocks.indexOf('export function ButtonBlock'), blocks.indexOf('export function LinksBlock'));
    assert.match(buttonBlock, /sx=\{\{ \.\.\.ordinaryPublicPageLinkSx/);
    const socialButton = blocks.slice(blocks.indexOf('export function SocialButtonBlock'), blocks.indexOf('export function MapBlock'));
    assert.doesNotMatch(socialButton, /ordinaryPublicPageLinkSx/);
    assert.doesNotMatch(renderer, /style=\{\{ overflow: 'visible' \}\}/);
    assert.match(renderer, /if \(!editor && \(!section\.visible \|\| !hasRenderableBlocks\)\)/);
    assert.match(renderer, /: document\.sections\.map\(\(section, sectionIndex\) => <SectionRenderer/);
    assert.match(renderer, /px: editor \? '14px' : \{ xs: 2, sm: 3 \}/);
    assert.match(renderer, /data-public-page-leading-block=\{blockIndex === 0 \? 'true' : undefined\}/);
    assert.match(dndCss, /\.public-page-avatar-cover-bleed \{[\s\S]{0,80}margin: 0 -14px/);
    assert.match(dndCss, /\[data-public-page-leading-block='true'\] \.public-page-avatar-cover-bleed \{[\s\S]{0,80}margin-top: -14px/);
    assert.doesNotMatch(blocks, /m: '-14px -14px 0'/);
    assert.match(renderer, /borderRadius: editor \? '22px' : 0/);
    assert.match(renderer, /\.\.\.resolvePublicPageThemeVariables\(document\.theme\)/);
    const preview = await read('src/components/public-page-builder/ResponsivePreview.tsx');
    assert.match(preview, /overflow: editor \? 'visible' : 'hidden'/);
    assert.match(preview, /border: `\$\{PUBLIC_PAGE_PREVIEW_GEOMETRY\.frameBorder\}px solid \$\{theme\.palette\.common\.white\}`/);
    assert.doesNotMatch(preview, /#202124/);
    assert.match(preview, /'& > \*': \{ width: '100%', minWidth: 0, flex: '1 0 auto', boxSizing: 'border-box' \}/);
    assert.match(preview, /'& > \* > \.MuiContainer-root': editor \? \{[\s\S]{0,120}width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'/);
    assert.match(preview, /editorDragGutter: 64/);
    assert.match(preview, /const virtualWidth = PUBLIC_PAGE_PREVIEW_GEOMETRY\.widths\[device\]/);
    assert.match(preview, /const editorOuterWidth = virtualWidth[\s\S]{0,180}PUBLIC_PAGE_PREVIEW_GEOMETRY\.editorDragGutter[\s\S]{0,180}PUBLIC_PAGE_PREVIEW_GEOMETRY\.frameBorder \* 2/);
    assert.match(preview, /const nextScale = Math\.min\(1, stage\.clientWidth \/ editorOuterWidth\)/);
    assert.match(preview, /width: editor[\s\S]{0,120}`\$\{virtualWidth\}px`/);
    assert.match(preview, /boxSizing: showPhoneFrame \? 'content-box' : 'border-box'/);
    assert.match(preview, /frameRadius: 32/);
    assert.match(preview, /borderRadius: showPhoneFrame \? undefined : 0/);
    assert.match(preview, /pl: editor && !compactEditor \? `\$\{PUBLIC_PAGE_PREVIEW_GEOMETRY\.editorDragGutter\}px` : 0/);
    assert.match(preview, /display: 'flex', flexDirection: 'column'/);
    assert.match(preview, /flex: '1 0 auto'/);
    assert.match(renderer, /maxWidth: 320/);
  });

  it('shows a live read-only mobile preview beside the design settings', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const preview = await read('src/components/public-page-builder/ResponsivePreview.tsx');
    const designStart = page.indexOf('<Dialog open={designOpen}');
    const designDialog = page.slice(designStart, page.indexOf('</Dialog>', designStart));

    assert.match(designDialog, /maxWidth=\{false\}/);
    assert.match(designDialog, /gridTemplateColumns: \{ xs: 'minmax\(0, 1fr\)', lg: 'minmax\(360px, 1fr\) minmax\(0, 2fr\)' \}/);
    assert.match(designDialog, /<ResponsivePreview document=\{state\.document\} device="mobile" mediaUrls=\{mediaUrls\} services=\{previewServices\} framed interactive=\{false\}/);
    assert.doesNotMatch(designDialog, /<ResponsivePreview[^>]*editor=/);
    assert.ok(designDialog.indexOf('<ResponsivePreview') < designDialog.indexOf('<DesignPanel'));
    assert.match(designDialog, /overflow: \{ xs: 'visible', lg: 'auto' \}/);

    assert.match(preview, /framed = false/);
    assert.match(preview, /interactive = true/);
    assert.match(preview, /ariaLabel\?: string/);
    assert.match(preview, /const PreviewScroller = styled\(Box\)\(\{[\s\S]{0,120}overflowX: 'hidden', overflowY: 'auto'/);
    assert.match(preview, /<PreviewScroller data-public-page-preview-scroller role=\{ariaLabel \? 'region' : undefined\} tabIndex=\{ariaLabel \? 0 : undefined\} aria-label=\{ariaLabel\}/);
    assert.match(preview, /px: editor \? \{ xs: 1\.25, md: 3 \} : framed \? 1 : \{ xs: 1, md: 3 \}/);
    assert.match(preview, /<PreviewFrame[\s\S]{0,120}inert: true, 'aria-hidden': true/);
    assert.match(preview, /!interactive \? \{ '& a, & button, & \[role="button"\]': \{ pointerEvents: 'none' \} \} : \{\}/);
    const scrollerStart = preview.indexOf('<PreviewScroller');
    const frameStart = preview.indexOf('<PreviewFrame', scrollerStart);
    assert.doesNotMatch(preview.slice(scrollerStart, frameStart), /pointerEvents: 'none'|inert|aria-hidden/);
    assert.match(preview, /framed[\s\S]{0,120}`min\(100%, \$\{PUBLIC_PAGE_PREVIEW_GEOMETRY\.framedMobileOuterWidth\}px\)`/);
    assert.match(page, /<ResponsivePreview document=\{previewDocument\} device=\{effectiveDevice\} mediaUrls=\{previewMediaUrls\}[\s\S]{0,100}ariaLabel=\{publicPageText\(locale, 'preview'\)\} editor=\{\{/);
  });

  it('uses a compact mobile editor shell without changing desktop controls or editor state', async () => {
    const page = await read('src/pages/PublicPageEditorPage.tsx');
    const shell = await read('src/components/public-page-builder/BuilderShell.tsx');
    const toolbar = await read('src/components/public-page-builder/BuilderToolbar.tsx');
    const addDialog = await read('src/components/public-page-builder/AddBlockDialog.tsx');
    const blockDialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');
    const responsivePreview = await read('src/components/public-page-builder/ResponsivePreview.tsx');
    const dndCss = await read('src/components/public-page-builder/publicPageDnd.css');
    const uiText = await read('src/components/public-page-builder/uiText.ts');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    assert.match(page, /useMediaQuery\(theme\.breakpoints\.down\('md'\)\)/);
    assert.match(page, /useState<PreviewDevice>\(\(\) => isCompact \? 'mobile' : 'desktop'\)/);
    assert.match(page, /const effectiveDevice: PreviewDevice = isCompact \? 'mobile' : device/);
    assert.match(page, /<ResponsivePreview document=\{previewDocument\} device=\{effectiveDevice\}/);
    assert.match(page, /services=\{previewServices\} compactEditor=\{isCompact\}/);
    assert.match(page, /<DeviceSwitcher compact=\{isCompact\} locale=\{locale\} value=\{effectiveDevice\} onChange=\{setDevice\} \/>/);
    assert.match(page, /<BuilderToolbar[\s\S]{0,100}compact=\{isCompact\}/);
    for (const key of ['undo', 'redo']) {
      assert.match(toolbar, new RegExp(`<Button variant="text"[\\s\\S]{0,100}aria-label=\\{publicPageText\\(locale, '${key}'\\)\\}[\\s\\S]{0,160}>\\{publicPageText\\(locale, '${key}'\\)\\}</Button>`));
    }
    assert.equal([...toolbar.matchAll(/disabled=\{isBusy\}/g)].length, 2);
    assert.match(toolbar, /aria-label=\{statusLabel\}/);
    assert.match(toolbar, /title=\{statusLabel\}/);
    assert.match(toolbar, /flexShrink: 1, maxWidth: '100%'[\s\S]{0,240}textOverflow: 'ellipsis', whiteSpace: 'nowrap'/);

    assert.match(shell, /bottomNavigation\?: ReactNode/);
    assert.match(shell, /gridTemplateRows: 'auto minmax\(0, 1fr\)'/);
    assert.doesNotMatch(shell, /<Paper square elevation=\{8\}/);
    assert.match(shell, /position: 'absolute'[\s\S]{0,180}bottom: 'calc\(16px \+ env\(safe-area-inset-bottom\)\)'[\s\S]{0,220}pointerEvents: 'none'/);
    assert.match(shell, /onWheel=\{\(event\) => \{[\s\S]{0,320}scrollPreview\(event\.deltaY \* multiplier\)/);
    assert.match(shell, /onTouchMove=\{\(event\) => \{[\s\S]{0,320}scrollPreview\(touchYRef\.current - y\)/);
    assert.match(page, /pageActions=\{<Stack component="nav" aria-label=\{publicPageText\(locale, 'mobileNavigation'\)\}/);
    assert.match(page, /aria-label=\{publicPageText\(locale, 'copyLink'\)\} onClick=\{\(\) => void copyLink\(\)\}/);
    assert.match(page, /aria-label=\{publicPageText\(locale, 'open'\)\} href=\{publicPageUrl\(editor\.publishedSlug\)\} target="_blank" rel="noopener noreferrer"/);
    assert.match(page, /bottomNavigation=\{<Box data-public-page-add-block-shell[\s\S]{0,320}<Button ref=\{addBlockButtonRef\}[\s\S]{0,180}onClick=\{\(\) => setAddBlockOpen\(true\)\}/);

    assert.match(page, /<AddBlockDialog open=\{addBlockOpen\} compact=\{isCompact\}/);
    assert.match(page, /<BlockEditorDialog open=\{blockEditorOpen\} compact=\{isCompact\}/);
    assert.equal([...page.matchAll(/<Dialog open=\{(?:pageSettingsOpen|designOpen)\}[^\n]+fullScreen=\{isCompact\}/g)].length, 2);
    assert.equal([...page.matchAll(/aria-label=\{publicPageText\(locale, 'close'\)\}[^\n]+set(?:PageSettings|Design)[^\n]+Open\(false\)/g)].length, 2);
    assert.match(addDialog, /fullScreen=\{compact\}/);
    assert.match(addDialog, /<BlockEditorDialog[\s\S]{0,180}compact=\{compact\}/);
    assert.match(blockDialog, /fullScreen=\{compact\}/);
    assert.match(blockDialog, /variant=\{compact \? 'scrollable' : 'standard'\} scrollButtons=\{compact \? 'auto' : false\} allowScrollButtonsMobile=\{compact\}/);
    assert.match(responsivePreview, /compactEditor = false/);
    assert.match(responsivePreview, /pb: editor \? 'calc\(80px \+ env\(safe-area-inset-bottom\)\)'/);
    assert.match(responsivePreview, /scrollPaddingBottom: editor \? 'calc\(80px \+ env\(safe-area-inset-bottom\)\)'/);
    assert.match(responsivePreview, /const nextScale = Math\.min\(1, stage\.clientWidth \/ editorOuterWidth\)/);
    assert.match(responsivePreview, /setScaledFrameHeight\(Math\.ceil\(frame\.scrollHeight \* nextScale\)\)/);
    assert.match(responsivePreview, /overflowX: 'hidden', overflowY: 'auto'/);
    assert.match(responsivePreview, /width: editor \? `\$\{editorOuterWidth \* editorScale\}px` : '100%'/);
    assert.match(responsivePreview, /transform: editor \? `scale\(\$\{editorScale\}\)` : undefined/);
    assert.match(responsivePreview, /public-page-editor-preview-surface--compact/);
    assert.match(dndCss, /\.public-page-editor-preview-surface--compact \.public-page-block-drag-rail \{\s*display: none;/);
    assert.match(uiText, /mobileNavigation: 'publicPageBuilder\.mobileNavigation'/);
    assert.equal([...dictionaries.matchAll(/mobileNavigation:/g)].length, 2);
  });

  it('offers individual branded social buttons in accessible duplicate-aware grids', async () => {
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const platforms = await read('src/features/public-page-builder/model/socialPlatforms.ts');
    const addDialog = await read('src/components/public-page-builder/AddBlockDialog.tsx');
    const page = await read('src/pages/PublicPageEditorPage.tsx');

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
    assert.match(blocks, /const avatarLayouts = AVATAR_LAYOUTS/);
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
  });

  it('blocks block-editor save when replacement and rollback media cleanup both fail', async () => {
    const dialog = await read('src/components/public-page-builder/BlockEditorDialog.tsx');

    assert.match(dialog, /const oldPending = pending\.find/);
    assert.match(dialog, /if \(oldPending && !\(await cleanupItems\(\[oldPending\]\)\)\) \{ await cleanupItems\(\[uploadedItem\]\); return; \}/);
    assert.match(dialog, /disabled=\{cleaning \|\| cleanupError \|\| !scheduleValid\}[\s\S]*onClick=\{\(\) => onSave\(/);
  });

  it('uses Figma-aligned Public Pages content and a data-driven responsive template picker', async () => {
    const pages = await read('src/pages/PublicPagesPage.tsx');
    const editorPage = await read('src/pages/PublicPageEditorPage.tsx');
    const switcher = await read('src/components/public-page-builder/DeviceSwitcher.tsx');

    assert.match(pages, /publicPageText\(locale, 'pagesSubtitle'\)/);
    assert.match(pages, /<Box component="section" aria-labelledby=\{pagesHeadingId\} sx=\{\{ minHeight: '100%'/);
    assert.match(pages, /<Typography id=\{pagesHeadingId\} variant="h4">/);
    assert.doesNotMatch(pages, /height: '100dvh'|<Box component="main"|workspaceTitle|HelpOutlined/);
    assert.match(pages, /size=\{\{ xs: 12, md: 6, lg: 4 \}\}/);
    assert.equal([...pages.matchAll(/PUBLIC_PAGE_TEMPLATES\.map\(\(template\)/g)].length, 2);
    assert.match(pages, /role="group" aria-labelledby=\{templatesHeadingId\}[\s\S]{0,600}<ButtonBase key=\{template\.id\} aria-pressed=\{selected\}/);
    assert.match(pages, /'&:focus-visible': \{ outline: '2px solid', outlineColor: 'primary\.main', outlineOffset: 2 \}/);
    assert.doesNotMatch(pages, /role="listbox"|role="option"|aria-selected/);
    assert.match(pages, /<Box inert aria-hidden aria-label=\{publicPageText\(locale, 'templatePreview'\)\}/);
    assert.match(pages, /<PublicPageRenderer document=\{templatePreview\} \/>/);
    assert.match(editorPage, /title=\{publicPageText\(locale, 'editorWorkspaceTitle'\)\}/);
    const navigation = editorPage.slice(editorPage.indexOf('pageActions={<Stack'), editorPage.indexOf('</Stack>}', editorPage.indexOf('pageActions={<Stack')) + 9);
    assert.doesNotMatch(navigation, /blockArchive/);
    assert.match(editorPage, /<AddBlockDialog[\s\S]{0,180}onOpenArchive=\{\(\) => setArchiveOpen\(true\)\}/);
    assert.match(switcher, /compact\?: boolean/);
    assert.match(switcher, /minWidth: compact \? 44/);
    assert.match(switcher, /disabled=\{compact && device !== 'mobile'\}/);
    assert.match(switcher, /<Tooltip title=\{label\}>\{icon\}<\/Tooltip>/);
  });

  it('does not expose archived-page editing', async () => {
    const pages = await read('src/pages/PublicPagesPage.tsx');
    const repositoryContract = await read('src/features/public-page-builder/repository/PublicPageRepository.ts');
    const apiRepository = await read('src/features/public-page-builder/repository/ApiPublicPageRepository.ts');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    assert.match(pages, /record\.status !== 'archived'[\s\S]*<Edit/);
    assert.match(pages, /window\.confirm\(publicPageText\(locale, 'deleteConfirm'\)\)/);
    assert.match(repositoryContract, /restore\(pageId: string, expectedRevision: number\): Promise<PublicPageRecord>/);
    assert.match(apiRepository, /\/api\/public-pages\/\$\{encodeURIComponent\(pageId\)\}\/restore`[\s\S]{0,80}\{ expectedRevision \}/);
    assert.match(pages, /const restore = async \(record: PublicPageRecord\)[\s\S]*repository\.restore\(record\.id, record\.revision\)[\s\S]*catch \(error\)[\s\S]*await load\(\)/);
    assert.match(pages, /record\.status === 'archived' \? \([\s\S]{0,180}<RestoreFromTrash/);
    assert.match(pages, /record\.status === 'archived' \? \([\s\S]{0,200}<Delete/);
    assert.match(pages, /<Typography color="text\.secondary"[^>]*>\{publicPageDisplayUrl\(record\.draft\.slug\)\}<\/Typography>/);
    assert.match(pages, /record\.published \? \([\s\S]{0,200}href=\{publicPageUrl\(record\.published\.slug\)\}[\s\S]{0,100}rel="noopener noreferrer"/);
    assert.doesNotMatch(pages, /meetli\.cc|href=\{publicPageUrl\(record\.draft\.slug\)\}/);
    assert.equal([...dictionaries.matchAll(/archive: [^\n]+restore: [^\n]+draft:/g)].length, 2);
    for (const key of ['restoreSlugConflict', 'restoreQuotaExceeded', 'restoreRevisionConflict', 'restorePageState', 'restoreError']) {
      assert.equal([...dictionaries.matchAll(new RegExp(`${key}:`, 'g'))].length, 2);
    }
  });

  it('creates a page from the currently selected template', async () => {
    const pages = await read('src/pages/PublicPagesPage.tsx');

    assert.match(pages, /getPublicPageTemplate\(templateId\)\?\.createDocument\(createStableId\(\)\)/);
    assert.match(pages, /const created = await repository\.create\(document\)/);
  });

  it('uses the shared service catalog for the Services carousel and public booking links', async () => {
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');
    const editorPage = await read('src/pages/PublicPageEditorPage.tsx');
    const publicPage = await read('src/pages/PublicPageViewPage.tsx');
    const serviceEditor = await read('src/components/public-page-builder/ServicesBlockEditor.tsx');
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');

    assert.match(registrations, /serviceIds: \[\], autoplayIntervalSeconds: null, showBookingButton: true/);
    assert.match(blocks, /from 'embla-carousel-react'/);
    assert.match(blocks, /align: 'center'/);
    assert.match(blocks, /containerType: 'inline-size', containerName: 'public-services'/);
    assert.match(blocks, /bgcolor: 'var\(--avatar-surface-background\)'/);
    assert.match(blocks, /borderRadius: 'var\(--block-border-radius\)'/);
    assert.doesNotMatch(blocks, /embla-carousel-autoplay/);
    assert.match(blocks, /data-service-dot/);
    assert.match(blocks, /inert=\{inactive \? true : undefined\} aria-hidden=\{inactive \? true : undefined\}/);
    assert.match(blocks, /booking\?service=\$\{service\.id\}/);
    assert.match(blocks, /prefers-reduced-motion: reduce/);
    assert.match(blocks, /autoplayConfigured && !editor && !reducedMotion/);
    assert.match(editorPage, /servicesApi\.list<ServicesResponse>\(accessToken\)/);
    assert.match(editorPage, /servicesInFlightRef\.current/);
    assert.match(editorPage, /window\.addEventListener\('focus', onFocus\)/);
    assert.doesNotMatch(serviceEditor, /block\.content\.services|nextContent\.services|servicesLegacyNotice/);
    assert.doesNotMatch(blocks, /hasCatalogServiceSelection|field="services"/);
    assert.doesNotMatch(publicPage, /hasCatalogServiceSelection/);
    assert.match(serviceEditor, /value=\{autoplaySecondsInput\}/);
    assert.match(serviceEditor, /onChange=\{\(event\) => setAutoplaySecondsInput\(event\.target\.value\)\} onBlur=\{commitAutoplaySeconds\}/);
    assert.match(publicPage, /booking-options/);
    assert.match(publicPage, /needsServices/);
    assert.match(publicPage, /status !== 'ready' \|\| !page \|\| page\.slug !== canonicalRouteSlug \|\| !needsServices/);
    assert.match(publicPage, /servicesRequestIdRef\.current !== requestId/);
    assert.match(publicPage, /servicesRequestIdRef\.current \+= 1/);
    assert.match(publicPage, /\[canonicalRouteSlug, needsServices, page, status\]/);
    assert.match(publicPage, /<PublicPageRenderer document=\{page\} services=\{services\}/);
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
    const blocks = await read('src/components/public-page-blocks/blocks.tsx');

    assert.match(blocks, /backgroundColor: 'color-mix\(in srgb, var\(--theme-link-background\) var\(--theme-link-background-opacity\), transparent\)'/);
    assert.doesNotMatch(blocks, /opacity: link\.backgroundOpacity \?\? linkDefault\.backgroundOpacity/);
  });
});
