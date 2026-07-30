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

  it('registers all 12 supported blocks and keeps unknown blocks recoverable', async () => {
    const registrations = await read('src/features/public-page-builder/config/registerBlocks.ts');
    const registry = await read('src/features/public-page-builder/model/blockRegistry.ts');
    const renderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');

    const registeredTypes = [...registrations.matchAll(/^\s*\{ type: '([^']+)'/gm)]
      .map((match) => match[1]);
    assert.deepEqual(registeredTypes, [
      'hero', 'links', 'text', 'image', 'gallery', 'services',
      'contacts', 'socials', 'messengers', 'map', 'divider', 'faq',
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

  it('does not expose archived-page editing', async () => {
    const pages = await read('src/pages/PublicPagesPage.tsx');

    assert.match(pages, /record\.status !== 'archived'[\s\S]*<Edit/);
    assert.match(pages, /window\.confirm\(publicPageText\(locale, 'deleteConfirm'\)\)/);
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
});
