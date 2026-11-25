import { expect, test } from '@playwright/test';
import { publicPageText as t } from '../../../src/components/public-page-builder/uiText.ts';
import { PUBLIC_PAGE_TEMPLATES } from '../../../src/features/public-page-builder/templates/index.ts';
import { PUBLIC_PAGE_THEMES } from '../../../src/features/public-page-builder/config/themes.ts';

const PAGE_ID = 'a1294860-b166-4a9e-8985-0c26ef6a2261';
const services = [
  { id: 101, name: 'Individual consultation', description: 'A personal session to discuss your goals and the next steps.', price: 2500, durationMin: 60, currency: 'RUB', firstSessionFree: true, imageUrl: null },
  { id: 102, name: 'Follow-up consultation', description: 'Review progress and choose a convenient time for the next meeting.', price: 1800, durationMin: 45, currency: 'RUB', firstSessionFree: false, imageUrl: null },
];

async function mockPublicPage(page, theme = PUBLIC_PAGE_THEMES[5], catalog = services, locale = 'en') {
  const draft = PUBLIC_PAGE_TEMPLATES.find(({ id }) => id === 'beauty').createDocument(PAGE_ID);
  draft.slug = 'design-preview';
  draft.theme = structuredClone(theme);
  draft.sections[0].blocks[0].content.heading = 'Лилия — консультации';
  draft.sections[0].blocks[0].content.subtitle = 'Помогаю разобраться в целях и выбрать следующие шаги';
  draft.sections[1].blocks[0].content.serviceIds = catalog.map(({ id }) => id);
  draft.sections[1].blocks[0].content.autoplayIntervalSeconds = 5;
  const state = {
    record: { id: PAGE_ID, draft, published: { ...structuredClone(draft), status: 'published' }, status: 'published', revision: 1, createdAt: draft.createdAt, updatedAt: draft.updatedAt, publishedAt: draft.createdAt, archivedAt: null },
    saves: [],
    unexpected: [],
  };
  await page.addInitScript((language) => {
    localStorage.setItem('ui-locale', language);
    localStorage.setItem('meetli_access_token', 'mock-token');
    localStorage.setItem('meetli_auth_user', JSON.stringify({ id: 'mock-admin', email: 'admin@example.test', role: 'owner', fullName: 'Test Admin' }));
  }, locale);
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/settings/user') { return json({}); }
    if (method === 'POST' && path.endsWith('/events')) { return route.fulfill({ status: 204 }); }
    if (method === 'GET' && path === `/api/public-pages/${PAGE_ID}/domain`) { return json({ domain: null }); }
    if (method === 'GET' && path === '/api/services') {
      return json({ specialists: [{ id: 1, name: 'Specialist', isActive: true }], services: catalog.map((service) => ({ ...service, basePrice: service.price, baseDurationMinutes: service.durationMin, isActive: true, imageMediaId: null, assignments: [{ specialistId: 1, specialistName: 'Specialist', isActive: true, priceOverride: null, durationOverrideMinutes: null }] })) });
    }
    if (method === 'GET' && path === '/api/public-pages/slug-availability') { return json({ slug: url.searchParams.get('slug'), available: true }); }
    if (method === 'GET' && path === `/api/public-pages/${PAGE_ID}`) { return json(state.record); }
    if (method === 'GET' && path === '/api/public-pages/by-slug/design-preview') { return json(state.record.published); }
    if (method === 'GET' && path === '/api/public-pages/by-slug/design-preview/booking-options') { return json({ services: catalog, specialists: [] }); }
    if (method === 'PUT' && path === `/api/public-pages/${PAGE_ID}/draft`) {
      const payload = request.postDataJSON();
      state.saves.push(payload);
      state.record = { ...state.record, draft: payload.document, revision: state.record.revision + 1 };
      return json(state.record);
    }
    if (method === 'POST' && path === `/api/public-pages/${PAGE_ID}/publish`) {
      state.record = { ...state.record, published: { ...structuredClone(state.record.draft), status: 'published' }, revision: state.record.revision + 1 };
      return json(state.record);
    }
    state.unexpected.push(`${method} ${path}`);
    return json({ code: 'unexpected_mock_request' }, 500);
  });
  return state;
}


const LOCALE = 'en';

async function openEditor(page, width = 1440) {
  const state = await mockPublicPage(page);
  state.record.draft.locale = 'en';
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  return state;
}

test('adding a video block says what is missing and only saves a trusted video link', async ({ page }) => {
  const state = await openEditor(page);
  await page.getByRole('button', { name: 'Add block', exact: true }).click();
  await page.getByRole('dialog', { name: 'Add block', exact: true }).getByRole('button', { name: t(LOCALE, 'blockTypeVideo'), exact: true }).click();
  const block = page.getByRole('dialog', { name: 'Configure block', exact: true });
  await expect(block.getByRole('alert')).toHaveText(t(LOCALE, 'blockIssueFields').replace('{fields}', t(LOCALE, 'fieldUrl')));
  const save = block.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  const url = block.getByLabel(t(LOCALE, 'fieldUrl'), { exact: true });
  await url.fill('https://example.com/not-a-video');
  await expect(save).toBeDisabled();
  await url.fill('https://youtu.be/dQw4w9WgXcQ');
  await expect(save).toBeEnabled();
  await expect(block.getByRole('alert')).toHaveCount(0);
  await save.click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.document.sections.flatMap((section) => section.blocks).some((item) => item.type === 'video' && item.content.url === 'https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  expect(state.unexpected).toEqual([]);
});

test('page language is chosen in settings and saved with the page', async ({ page }) => {
  const state = await openEditor(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.getByRole('button', { name: t(LOCALE, 'addressAndSearch'), exact: true }).click();
  await dialog.getByRole('combobox', { name: t(LOCALE, 'pageLanguage'), exact: true }).click();
  await page.getByRole('option', { name: t(LOCALE, 'languageRu'), exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.document.locale).toBe('ru');
  expect(state.unexpected).toEqual([]);
});

test('a custom domain is connected, checked and removed from settings', async ({ page }) => {
  const state = await mockPublicPage(page);
  state.record.draft.locale = 'en';
  let domain = null;
  await page.route(`**/api/public-pages/${PAGE_ID}/domain**`, async (route) => {
    const request = route.request();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') { return json({ domain }); }
    if (request.method() === 'PUT') {
      const requested = request.postDataJSON().domain;
      if (requested === 'taken.example.com') { return json({ code: 'domain_conflict' }, 409); }
      domain = { domain: requested, verified: false, target: 'meetli.example' };
      return json({ domain });
    }
    if (request.method() === 'POST' && path.endsWith('/verify')) { domain = { ...domain, verified: true }; return json({ domain }); }
    if (request.method() === 'DELETE') { domain = null; return route.fulfill({ status: 204 }); }
    return json({ code: 'unexpected_mock_request' }, 500);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.getByRole('button', { name: t(LOCALE, 'addressAndSearch'), exact: true }).click();
  const input = dialog.getByLabel(t(LOCALE, 'customDomain'), { exact: true });
  await input.fill('taken.example.com');
  await dialog.getByRole('button', { name: t(LOCALE, 'domainConnect'), exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(t(LOCALE, 'domainTaken'));
  await input.fill('studio.example.com');
  await dialog.getByRole('button', { name: t(LOCALE, 'domainConnect'), exact: true }).click();
  await expect(dialog.getByText(t(LOCALE, 'domainPending'), { exact: true })).toBeVisible();
  await expect(dialog.getByText('meetli.example', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: t(LOCALE, 'domainCheck'), exact: true }).click();
  await expect(dialog.getByText(t(LOCALE, 'domainConnected'), { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: t(LOCALE, 'domainCheck'), exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: t(LOCALE, 'domainRemove'), exact: true }).click();
  await expect(dialog.getByLabel(t(LOCALE, 'customDomain'), { exact: true })).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test('statistics page shows totals, named blocks, removed blocks and follows the period', async ({ page }) => {
  const state = await mockPublicPage(page);
  state.record.draft.locale = 'en';
  const requested = [];
  const serviceBlock = state.record.published.sections[1].blocks[0];
  await page.route(`**/api/public-pages/${PAGE_ID}/analytics**`, async (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get('days'));
    requested.push(days);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      days, totals: { views: 40, clicks: 10 },
      daily: [{ date: '2026-11-20', views: 15, clicks: 4 }, { date: '2026-11-21', views: 25, clicks: 6 }],
      blocks: [{ blockId: serviceBlock.id, clicks: 7 }, { blockId: 'deleted-block-id', clicks: 3 }],
      sources: [{ source: '', views: 30 }, { source: 'instagram.com', views: 10 }],
    }) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/public-pages/${PAGE_ID}/analytics`);
  await expect(page.getByText(t(LOCALE, 'analyticsViews'), { exact: true })).toBeVisible();
  await expect(page.getByText('25%', { exact: true })).toBeVisible();
  await expect(page.getByText(t(LOCALE, 'analyticsRemovedBlock'), { exact: true })).toBeVisible();
  await expect(page.getByText('deleted-block-id')).toHaveCount(0);
  await expect(page.getByText(t(LOCALE, 'analyticsDirect'), { exact: true })).toBeVisible();
  await expect(page.getByText('instagram.com', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: t(LOCALE, 'analyticsPeriod').replace('{days}', '7') }).click();
  await expect.poll(() => requested.at(-1)).toBe(7);
  expect(state.unexpected).toEqual([]);
});
