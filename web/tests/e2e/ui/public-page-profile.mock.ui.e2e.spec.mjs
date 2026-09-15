import { expect, test } from '@playwright/test';
import { getPublicPageTemplate } from '../../../src/features/public-page-builder/templates/index.ts';
import { PUBLIC_PAGE_THEMES } from '../../../src/features/public-page-builder/config/themes.ts';

const PAGE_ID = 'd2915d45-8a1c-4a97-aa50-abf89d5aca01';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAMElEQVRIiWPwL5s8IIhh1OKy0aD2H01ck0ezU9loAeI/WmROHq0kykarxcnDv1oEAGyrMz2meIthAAAAAElFTkSuQmCC', 'base64');
const uploadFile = { name: 'profile.png', mimeType: 'image/png', buffer: PNG };
const media = (index, alt) => ({ id: `b2998611-95ba-4b32-9a58-${String(index).padStart(12, '0')}`, url: `https://media.example.test/api/media/${index}`, mimeType: 'image/png', width: 1, height: 1, alt });

function documentFixture(mixed = false) {
  const photo = media(1, 'Original avatar');
  // Persisted dimensions intentionally disagree with the decoded landscape image,
  // matching the EXIF-orientation mismatch produced by common phone photos.
  photo.width = 20;
  photo.height = 40;
  const document = getPublicPageTemplate('specialist').createDocument(PAGE_ID);
  document.sections[0].blocks[0].name = 'Avatar';
  Object.assign(document.sections[0].blocks[0].content, { heading: 'Original avatar', subtitle: 'Original description', imageMediaId: photo.id, imageAlt: photo.alt });
  document.media.push(photo);
  document.theme = { ...structuredClone(PUBLIC_PAGE_THEMES[5]), backgroundMediaId: media(2, 'Background').id, backgroundPosition: '17% 63%' };
  document.media.push(media(2, 'Background'));
  if (mixed) {
    document.profile = { displayName: 'Legacy profile', description: 'Legacy description', avatarMediaId: photo.id, logoMediaId: media(3, 'Logo').id, avatarPosition: '50% 50%' };
    document.media.push(media(3, 'Logo'));
    const extra = structuredClone(document.sections[0]);
    extra.id = 'hidden-section';
    extra.visible = false;
    extra.blocks[0].id = 'hidden-avatar';
    extra.blocks[0].name = 'Hidden person';
    extra.blocks[0].content.heading = 'Hidden person';
    document.sections.push(extra);
  }
  return document;
}

async function mockProfile(page, { mixed = false, locale = 'en' } = {}) {
  const document = documentFixture(mixed);
  const state = { record: { id: PAGE_ID, draft: document, published: null, status: 'draft', revision: 1, createdAt: document.createdAt, updatedAt: document.updatedAt, publishedAt: null, archivedAt: null }, saves: [], uploads: [], deletes: [], unexpected: [], uploadError: false, uploadGate: null };
  await page.addInitScript((language) => {
    localStorage.setItem('ui-locale', language);
    localStorage.setItem('scheduletm_access_token', 'profile-mock-token');
    localStorage.setItem('scheduletm_auth_user', JSON.stringify({ id: 'profile-test-owner', email: 'owner@example.test', fullName: 'Owner', role: 'owner' }));
  }, locale);
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'PUT' && path === '/api/settings/user') { return json({}); }
    if (method === 'GET' && path === '/api/services') { return json({ services: [], specialists: [] }); }
    if (method === 'GET' && path === '/api/public-pages') { return json([state.record]); }
    if (method === 'POST' && path === '/api/public-pages') {
      const { document: created } = request.postDataJSON();
      state.created = created;
      state.record = { ...state.record, id: created.id, draft: created, revision: 1 };
      return json(state.record, 201);
    }
    if (method === 'GET' && path === '/api/public-pages/slug-availability') { return json({ slug: url.searchParams.get('slug'), available: true }); }
    if (method === 'GET' && path === `/api/public-pages/${state.record.id}`) { return json(state.record); }
    if (method === 'PUT' && path === `/api/public-pages/${PAGE_ID}/draft`) {
      const payload = request.postDataJSON();
      state.saves.push(structuredClone(payload.document));
      state.record.draft = payload.document;
      state.record.revision += 1;
      return json(state.record);
    }
    if (method === 'POST' && path === '/api/public-pages/media') {
      if (state.uploadGate) { await state.uploadGate; }
      if (state.uploadError) { return json({ code: 'storage_unavailable' }, 503); }
      const uploaded = media(10 + state.uploads.length, '');
      state.uploads.push(uploaded);
      return json(uploaded, 201);
    }
    if (method === 'GET' && (/^\/api\/public-pages\/media\/[^/]+\/preview$/.test(path) || /^\/api\/media\//.test(path))) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (method === 'DELETE' && /^\/api\/public-pages\/media\/[^/]+$/.test(path)) {
      state.deletes.push(path.split('/').at(-1));
      return route.fulfill({ status: 204 });
    }
    state.unexpected.push(`${method} ${path}`);
    return json({ code: 'unexpected_mock_request' }, 500);
  });
  return state;
}

async function openDesign(page) {
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Design', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeAndSave(page, dialog, state) {
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.length).toBeGreaterThan(0);
}

test('creation uses the original template chooser and direct new route creates a blank page', async ({ page }) => {
  const state = await mockProfile(page);
  await page.goto('/public-pages');
  await page.getByRole('button', { name: 'Create page', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create page', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
  await dialog.getByRole('combobox', { name: /^Template\b/ }).click();
  await expect(page.getByRole('option')).toHaveCount(5);
  await page.getByRole('option', { name: 'Specialist', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create page', exact: true }).click();
  await expect.poll(() => state.created?.sections[0]?.blocks[0]?.content.heading).toBe('Your name');
  await expect(page).toHaveURL(`/public-pages/${state.record.id}/edit`);
  state.created = null;
  await page.goto('/public-pages/new');
  await expect.poll(() => state.created?.profile.displayName).toBe('');
  expect(state.created.sections).toHaveLength(1);
  expect(state.created.sections[0].blocks).toEqual([]);
  expect(state.created.media).toEqual([]);
  await expect(page).toHaveURL(`/public-pages/${state.record.id}/edit`);
  expect(state.unexpected).toEqual([]);
});

test('Intro remains editable through its block dialog and design surfaces have no contrast report', async ({ page }) => {
  const state = await mockProfile(page);
  const original = structuredClone(state.record.draft);
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('group', { name: 'Editable block: Avatar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: 'Headline', exact: true })).toHaveValue('Original avatar');
  await dialog.getByRole('textbox', { name: 'Headline', exact: true }).fill('Updated Intro');
  for (const name of ['Design', 'Section']) {
    await dialog.getByRole('tab', { name, exact: true }).click();
    await expect(dialog.getByText('Text contrast', { exact: true })).toHaveCount(0);
  }
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.sections[0].blocks[0].content.heading).toBe('Updated Intro');
  expect(state.saves.at(-1).profile).toEqual(original.profile);
  expect(state.saves.at(-1).sections.slice(1)).toEqual(original.sections.slice(1));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Updated Intro', exact: true })).toHaveCount(1);
  expect(state.unexpected).toEqual([]);
});

test('themes and background retain their controls while custom colors stay in page settings', async ({ page }, testInfo) => {
  const state = await mockProfile(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  const dialog = await openDesign(page);
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.getByText('Text contrast', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Background', exact: true })).toHaveCount(0);
  for (const theme of PUBLIC_PAGE_THEMES) { await expect(dialog.getByRole('button', { name: theme.id, exact: true })).toBeVisible(); }
  await dialog.getByRole('button', { name: 'z109', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Focal point', exact: true })).toHaveValue('17% 63%');
  await dialog.getByRole('textbox', { name: 'Focal point', exact: true }).fill('100% 100%');
  await page.screenshot({ path: testInfo.outputPath('appearance-desktop.png'), fullPage: false });
  await closeAndSave(page, dialog, state);
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Page settings', exact: true });
  for (const [key, color] of [['background', '#243340'], ['surface', '#344554'], ['text', '#f2f4f8'], ['primary', '#729fcf']]) {
    await settings.getByRole('textbox', { name: `Page color: ${key}`, exact: true }).last().fill(color);
  }
  await closeAndSave(page, settings, state);
  await expect.poll(() => state.saves.at(-1).theme.colors.primary).toBe('#729fcf');
  expect(state.saves.at(-1).theme.backgroundPosition).toBe('100% 100%');
  expect(state.saves.at(-1).theme.backgroundMediaId).toBe(media(2, '').id);
  await page.reload();
  const reopened = await openDesign(page);
  await expect(reopened.getByRole('textbox', { name: 'Focal point', exact: true })).toHaveValue('100% 100%');
  expect(state.unexpected).toEqual([]);
});

test('existing page profile stays editable in settings without changing Intro blocks', async ({ page }) => {
  const state = await mockProfile(page, { mixed: true });
  const original = structuredClone(state.record.draft);
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Page settings', exact: true });
  const name = dialog.getByRole('textbox', { name: 'Display name', exact: true });
  await expect(name).toHaveValue('Legacy profile');
  await name.fill('');
  await dialog.getByRole('textbox', { name: 'Profile description', exact: true }).fill('');
  await name.fill('Changed legacy profile');
  await closeAndSave(page, dialog, state);
  const saved = state.saves.at(-1);
  expect(saved.sections).toEqual(original.sections);
  expect(saved.profile.displayName).toBe('Changed legacy profile');
  expect(saved.profile.logoMediaId).toBe(original.profile.logoMediaId);
  expect(saved.theme.backgroundPosition).toBe('17% 63%');
  expect(saved.media).toEqual(original.media);
  expect(state.deletes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('profile photo position is circular, draggable, keyboard accessible and persisted as one history change', async ({ page }, testInfo) => {
  const state = await mockProfile(page, { mixed: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Page settings', exact: true });
  let positionControl = dialog.getByRole('button', { name: 'Adjust profile photo position', exact: true });
  await positionControl.scrollIntoViewIfNeeded();
  await expect(positionControl).toBeVisible();
  await expect(positionControl).toBeEnabled();
  await expect(positionControl).toHaveAttribute('aria-busy', 'false');
  expect(await positionControl.locator('img').evaluate((image) => [image.naturalWidth, image.naturalHeight])).toEqual([40, 20]);
  const bounds = await positionControl.boundingBox();
  expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(1);
  await expect(positionControl).toHaveCSS('border-radius', '50%');
  await expect(positionControl.locator('img')).toHaveCSS('object-position', '50% 50%');
  await page.screenshot({ path: testInfo.outputPath('profile-avatar-position.png'), fullPage: false });

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 20, bounds.y + bounds.height / 2, { steps: 4 });
  await page.mouse.move(bounds.x + bounds.width / 2 - 40, bounds.y + bounds.height / 2, { steps: 4 });
  const transientPosition = await positionControl.locator('img').evaluate((image) => getComputedStyle(image).objectPosition);
  expect(transientPosition).not.toBe('50% 50%');
  await page.mouse.up();
  const draggedPosition = await positionControl.locator('img').evaluate((image) => getComputedStyle(image).objectPosition);
  expect(draggedPosition).not.toBe('50% 50%');

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.profile.avatarPosition).toBe('50% 50%');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.profile.avatarPosition).toBe(draggedPosition);

  await page.reload();
  const renderedProfilePhoto = page.locator('header img[alt="Original avatar"]');
  await expect(renderedProfilePhoto).toHaveCSS('object-position', draggedPosition);
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Page settings', exact: true });
  positionControl = dialog.getByRole('button', { name: 'Adjust profile photo position', exact: true });
  await positionControl.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(positionControl).toBeFocused();
  const keyboardPosition = await positionControl.locator('img').evaluate((image) => getComputedStyle(image).objectPosition);
  expect(Number.parseInt(keyboardPosition, 10)).toBe(Math.min(100, Number.parseInt(draggedPosition, 10) + 5));
  await dialog.getByRole('button', { name: 'Center photo', exact: true }).click();
  await expect(positionControl.locator('img')).toHaveCSS('object-position', '50% 50%');
  await closeAndSave(page, dialog, state);
  expect(state.saves.at(-1).profile.avatarPosition).toBe('50% 50%');
  expect(state.unexpected).toEqual([]);
});

test('replacing and removing the profile photo reset its position to the center', async ({ page }) => {
  const state = await mockProfile(page, { mixed: true });
  state.record.draft.profile.avatarPosition = '12% 50%';
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Page settings', exact: true });
  await dialog.locator('input[type="file"]').nth(1).setInputFiles(uploadFile);
  await expect(dialog.getByRole('progressbar')).not.toBeVisible();
  await closeAndSave(page, dialog, state);
  expect(state.saves.at(-1).profile.avatarMediaId).toBe(state.uploads.at(-1).id);
  expect(state.saves.at(-1).profile.avatarPosition).toBe('50% 50%');

  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Page settings', exact: true });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await closeAndSave(page, dialog, state);
  expect(state.saves.at(-1).profile.avatarMediaId).toBeNull();
  expect(state.saves.at(-1).profile.avatarPosition).toBe('50% 50%');
  expect(state.unexpected).toEqual([]);
});

test('design controls remain accessible on narrow screens without profile or contrast panels', async ({ page }, testInfo) => {
  const state = await mockProfile(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  const dialog = await openDesign(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(dialog.getByRole('button', { name: 'z101', exact: true })).toBeVisible();
    await expect(dialog.getByRole('tab')).toHaveCount(0);
    await expect(dialog.getByText('Text contrast', { exact: true })).toHaveCount(0);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`design-${width}.png`), fullPage: false });
  }
  expect(state.unexpected).toEqual([]);
});

test('late background upload is cleaned after browser Back without changing the document', async ({ page }) => {
  const state = await mockProfile(page);
  const original = structuredClone(state.record.draft);
  await page.goto('/public-pages');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(`/public-pages/${PAGE_ID}/edit`);
  const dialog = await openDesign(page);
  let release;
  state.uploadGate = new Promise((resolve) => { release = resolve; });
  await dialog.locator('input[type="file"]').setInputFiles(uploadFile);
  await expect(dialog.getByRole('progressbar')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
  await page.goBack();
  await expect(page).toHaveURL('/public-pages');
  release();
  await expect.poll(() => state.uploads.length).toBe(1);
  await expect.poll(() => state.deletes).toContain(state.uploads[0].id);
  expect(state.record.draft).toEqual(original);
  expect(state.unexpected).toEqual([]);
});
