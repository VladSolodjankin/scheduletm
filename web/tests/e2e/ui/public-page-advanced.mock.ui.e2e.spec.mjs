import { expect, test } from '@playwright/test';
import { PUBLIC_PAGE_TEMPLATES } from '../../../src/features/public-page-builder/templates/index.ts';
import { publicPageText } from '../../../src/components/public-page-builder/uiText.ts';

const PAGE_ID = 'c93e91d7-7eb2-41cf-bdac-c8c9d251bb11';
const blockOf = (state) => state.record.draft.sections[0].blocks[0];

async function mockPage(page, locale) {
  const draft = PUBLIC_PAGE_TEMPLATES.find(({ id }) => id === 'beauty').createDocument(PAGE_ID);
  draft.slug = 'advanced-mock';
  draft.timezone = 'Europe/Samara';
  draft.sections = [draft.sections[0]];
  draft.sections[0].blocks = [{ ...draft.sections[0].blocks[0], id: 'audit-button', name: 'Audit CTA', type: 'button',
    content: { label: 'Audit CTA', subtitle: '', openInNewTab: false, icon: 'link', action: { type: 'url', url: 'https://example.test/cta' } } }];
  const state = { record: { id: PAGE_ID, draft, published: { ...structuredClone(draft), status: 'published' }, status: 'published', revision: 1,
    createdAt: draft.createdAt, updatedAt: draft.updatedAt, publishedAt: draft.createdAt, archivedAt: null }, saves: [], unexpected: [] };
  await page.addInitScript((locale) => {
    localStorage.setItem('ui-locale', locale);
    localStorage.setItem('scheduletm_access_token', 'mock-token');
    localStorage.setItem('scheduletm_auth_user', JSON.stringify({ id: 'mock-admin', email: 'admin@example.test', role: 'admin', fullName: 'Test Admin' }));
  }, locale);
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'GET' && url.pathname === '/api/services') return json({ services: [], specialists: [] });
    if (method === 'PUT' && url.pathname === '/api/settings/user') return json({});
    if (method === 'GET' && url.pathname === '/api/public-pages/slug-availability') return json({ slug: url.searchParams.get('slug'), available: true });
    if (method === 'GET' && url.pathname === `/api/public-pages/${PAGE_ID}`) return json(state.record);
    if (method === 'GET' && url.pathname === '/api/public-pages/by-slug/advanced-mock') return json(state.record.published);
    if (method === 'GET' && url.pathname === '/api/public-pages/by-slug/advanced-mock/booking-options') return json({ services: [], specialists: [] });
    if (method === 'PUT' && url.pathname === `/api/public-pages/${PAGE_ID}/draft`) {
      const payload = request.postDataJSON();
      expect(payload.expectedRevision).toBe(state.record.revision);
      expect(payload.document.schemaVersion).toBe(4);
      state.saves.push(payload);
      state.record = { ...state.record, draft: payload.document, revision: state.record.revision + 1 };
      return json(state.record);
    }
    state.unexpected.push(`${method} ${url.pathname}`);
    return json({ code: 'unexpected_mock_request' }, 500);
  });
  return state;
}

for (const [width, locale] of [[1440, 'en'], [390, 'ru']]) {
  test(`advanced button settings, schedule and archive roundtrip at ${width}px ${locale}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(10_000);
    const t = (key) => publicPageText(locale, key);
    const state = await mockPage(page, locale);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/public-pages/${PAGE_ID}/edit`);
    const edit = async () => {
      await page.locator('[data-editor-block-id="audit-button"]').press('Enter');
      return page.getByRole('dialog').last();
    };
    let dialog = await edit();
    await dialog.getByLabel(t('fieldSubtitle'), { exact: true }).fill('Saved subtitle');
    await dialog.locator('[data-public-page-editor-tab="settings"]').click();
    await dialog.getByRole('switch', { name: t('openInNewTab'), exact: true }).check();
    await dialog.getByRole('switch', { name: t('scheduleEnabled'), exact: true }).check();
    await expect(dialog.getByRole('button', { name: t('save'), exact: true })).toBeDisabled();
    await dialog.getByLabel(t('scheduleFrom'), { exact: true }).fill('2026-10-01T10:00');
    await dialog.getByLabel(t('scheduleUntil'), { exact: true }).fill('2026-10-02T10:00');
    await dialog.getByRole('switch', { name: t('scheduleWeekdays'), exact: true }).check();
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) await dialog.getByRole('button', { name: t(day), exact: true }).click();
    await expect(dialog.getByRole('button', { name: t('save'), exact: true })).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText(t('scheduleNoDays'));
    await dialog.getByRole('button', { name: t('sunday'), exact: true }).click();
    await expect(dialog.getByRole('button', { name: t('save'), exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`schedule-${locale}-${width}.png`), fullPage: true });
    await dialog.getByRole('button', { name: t('save'), exact: true }).click();
    await page.getByRole('button', { name: t('save'), exact: true }).click();
    await expect.poll(() => blockOf(state).content.subtitle).toBe('Saved subtitle');
    expect(blockOf(state).content.openInNewTab).toBe(true);
    expect(blockOf(state).schedule).toEqual({ period: { startAt: '2026-10-01T06:00:00.000Z', endAt: '2026-10-02T06:00:00.000Z' }, weekdays: [7] });
    await page.reload();
    dialog = await edit();
    await expect(dialog.getByLabel(t('fieldSubtitle'), { exact: true })).toHaveValue('Saved subtitle');
    await dialog.locator('[data-public-page-editor-tab="settings"]').click();
    await expect(dialog.getByRole('switch', { name: t('openInNewTab'), exact: true })).toBeChecked();
    await expect(dialog.getByRole('button', { name: t('sunday'), exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: t('cancel'), exact: true }).click();
    await page.locator('[data-editor-block-id="audit-button"]').focus();
    await page.getByRole('button', { name: t('archiveBlock'), exact: true }).click();
    await page.getByRole('button', { name: t('undo'), exact: true }).click();
    await page.locator('[data-editor-block-id="audit-button"]').focus();
    await expect(page.getByRole('button', { name: t('archiveBlock'), exact: true })).toBeVisible();
    await page.getByRole('button', { name: t('archiveBlock'), exact: true }).click();
    await page.getByRole('button', { name: t('blockArchive'), exact: true }).click();
    const archive = page.getByRole('dialog', { name: t('blockArchive'), exact: true });
    await archive.getByRole('button', { name: t('restore'), exact: true }).click();
    await expect(archive.getByRole('alert')).toContainText(t('blockRestored'));
    await archive.getByRole('button', { name: t('close'), exact: true }).click();
    await page.getByRole('button', { name: t('save'), exact: true }).click();
    await expect.poll(() => state.record.draft.archivedBlocks.length).toBe(0);
    await page.getByRole('button', { name: t('design'), exact: true }).click();
    const design = page.getByRole('dialog', { name: t('design'), exact: true });
    await expect(design.getByRole('tab', { name: t('simpleEditor'), exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(design.getByRole('button', { name: t('colorPalettes'), exact: true })).toHaveAttribute('aria-expanded', 'true');
    await design.getByRole('tab', { name: t('advancedEditor'), exact: true }).click();
    const advanced = design.locator('[data-public-page-advanced-design]');
    await expect(advanced.getByRole('button', { name: t('typography'), exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: testInfo.outputPath(`advanced-typography-${locale}-${width}.png`), fullPage: true });
    await advanced.getByRole('button', { name: t('buttons'), exact: true }).click();
    await expect(advanced.getByRole('button', { name: t('typography'), exact: true })).toHaveAttribute('aria-expanded', 'false');
    await advanced.getByLabel(t('borderWidth'), { exact: true }).fill('3');
    await page.screenshot({ path: testInfo.outputPath(`advanced-design-${locale}-${width}.png`), fullPage: true });
    await design.getByRole('button', { name: t('close'), exact: true }).click();
    await page.getByRole('button', { name: t('save'), exact: true }).click();
    await expect.poll(() => state.record.draft.theme.styleDefaults.linkStyle.borderWidth).toBe(3);
    await page.reload();
    await page.getByRole('button', { name: t('design'), exact: true }).click();
    await page.getByRole('dialog', { name: t('design'), exact: true }).getByRole('tab', { name: t('advancedEditor'), exact: true }).click();
    await page.locator('[data-public-page-advanced-design]').getByRole('button', { name: t('buttons'), exact: true }).click();
    await expect(page.locator('[data-public-page-advanced-design]').getByLabel(t('borderWidth'), { exact: true })).toHaveValue('3');
    expect(state.unexpected).toEqual([]);
  });
}

test('public scheduled button appears at start and disappears at end without reloading', async ({ page }) => {
  const state = await mockPage(page, 'en');
  state.record.published.sections[0].blocks[0].schedule = { period: { startAt: '2026-10-04T06:00:00.000Z', endAt: '2026-10-04T06:01:00.000Z' }, weekdays: [7] };
  await page.clock.install({ time: new Date('2026-10-04T05:00:00.000Z') });
  await page.clock.pauseAt(new Date('2026-10-04T05:59:59.000Z'));
  await page.goto('/advanced-mock');
  await expect(page.getByRole('link', { name: 'Audit CTA', exact: true })).toHaveCount(0);
  await page.clock.runFor(1100);
  await expect(page.getByRole('link', { name: 'Audit CTA', exact: true })).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(page.getByRole('link', { name: 'Audit CTA', exact: true })).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test('public rich text uses page typography and explicit section overrides', async ({ page }, testInfo) => {
  const state = await mockPage(page, 'en');
  const document = state.record.published;
  document.theme.tokens.typography.h1 = { ...document.theme.tokens.typography.h1, fontSize: 48, fontWeight: 700 };
  document.theme.tokens.typography.textMedium = { ...document.theme.tokens.typography.textMedium, fontSize: 22, fontWeight: 500 };
  document.theme.styleDefaults.headingStyle = { ...document.theme.styleDefaults.headingStyle, fontSize: 48, fontWeight: 700, fontStyle: 'italic' };
  document.theme.styleDefaults.textStyle = { ...document.theme.styleDefaults.textStyle, fontSize: 22, fontWeight: 500, fontStyle: 'italic' };
  const section = document.sections[0];
  section.blocks[0] = { ...section.blocks[0], type: 'text', content: { document: { type: 'rich-text-v1', paragraphs: [
    { size: 'h1', alignment: 'left', fontFamily: null, runs: [{ text: 'Page heading typography' }] },
    { size: 'medium', alignment: 'left', fontFamily: null, runs: [{ text: 'Page body typography' }] },
  ] } } };
  const override = structuredClone(section);
  override.id = 'explicit-section';
  override.blocks[0].id = 'explicit-text';
  override.design.headingStyle = { ...override.design.headingStyle, fontSize: 28, fontWeight: 600, fontStyle: 'normal' };
  override.design.textStyle = { ...override.design.textStyle, fontSize: 18, fontWeight: 400, fontStyle: 'normal' };
  override.blocks[0].content.document.paragraphs[0].runs[0].text = 'Explicit section heading';
  override.blocks[0].content.document.paragraphs[1].runs[0].text = 'Explicit section body';
  document.sections.push(override);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/advanced-mock');
  for (const [label, size, weight, style] of [
    ['Page heading typography', '48px', '700', 'italic'], ['Page body typography', '22px', '500', 'italic'],
    ['Explicit section heading', '28px', '600', 'normal'], ['Explicit section body', '18px', '400', 'normal'],
  ]) {
    const paragraph = page.locator('p[data-public-page-richtext-size]').filter({ hasText: label });
    await expect(paragraph).toHaveCSS('font-size', size);
    await expect(paragraph).toHaveCSS('font-weight', weight);
    await expect(paragraph).toHaveCSS('font-style', style);
  }
  await page.screenshot({ path: testInfo.outputPath('public-typography-inheritance.png'), fullPage: true });
  expect(state.unexpected).toEqual([]);
});
