import { expect, test } from '@playwright/test';
import { dictionaries } from '../../../src/shared/i18n/dictionaries.ts';
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


const b = dictionaries.en.publicBooking;
const SLOT = '2030-01-15T10:00:00.000Z';

async function mockBooking(page, { appointment } = {}) {
  const state = await mockPublicPage(page);
  state.record.published.locale = 'en';
  state.requests = [];
  await page.route('**/api/public-pages/by-slug/design-preview/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/booking-options')) { return json({ services, specialists: [{ id: 7, name: 'Anna Specialist' }] }); }
    if (path.endsWith('/available-slots')) { state.requests.push(new URL(request.url()).searchParams.toString()); return json({ slots: [SLOT] }); }
    if (path.endsWith('/appointments') && request.method() === 'POST') {
      state.requests.push(request.postDataJSON());
      return appointment ? appointment(json) : json({ id: 501, accessCode: 'ABC-123' }, 201);
    }
    if (path.endsWith('/events')) { return route.fulfill({ status: 204 }); }
    return route.fallback();
  });
  return state;
}

async function openBooking(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/design-preview');
  await page.getByRole('region', { name: 'Services', exact: true }).getByRole('button', { name: 'Book', exact: true }).click();
  return page.getByRole('dialog');
}

for (const width of [390, 1440]) {
  test(`a visitor books a chosen service and gets the access code at ${width}px`, async ({ page }) => {
    const state = await mockBooking(page);
    const dialog = await openBooking(page, width);
    await expect(dialog.getByRole('combobox', { name: b.service })).toContainText('Individual consultation');
    const submit = dialog.getByRole('button', { name: b.submit, exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByRole('combobox', { name: b.specialist }).click();
    await page.getByRole('option', { name: 'Anna Specialist' }).click();
    const date = dialog.getByLabel(b.date);
    expect(await date.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await date.fill('2030-01-15');
    const slot = dialog.getByRole('button', { name: new Date(SLOT).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) });
    await slot.click();
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(b.firstName).fill('Ivan');
    await dialog.getByLabel(b.lastName).fill('Petrov');
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(b.email).fill('ivan@example.com');
    await expect(submit).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await submit.click();
    await expect(dialog.getByText('ABC-123', { exact: true })).toBeVisible();
    const posted = state.requests.find((entry) => typeof entry === 'object');
    expect(posted).toMatchObject({ firstName: 'Ivan', lastName: 'Petrov', email: 'ivan@example.com', specialistId: 7, serviceId: 101, startAt: SLOT });
    expect(posted.phone).toBeUndefined();
  });
}

test('a visitor sees the reason when the chosen time was just taken and can retry', async ({ page }) => {
  let attempts = 0;
  await mockBooking(page, { appointment: (json) => (++attempts === 1 ? json({ code: 'slot_unavailable', message: 'This time has just been taken' }, 409) : json({ id: 502, accessCode: 'XYZ-789' }, 201)) });
  const dialog = await openBooking(page, 390);
  await dialog.getByRole('combobox', { name: b.specialist }).click();
  await page.getByRole('option', { name: 'Anna Specialist' }).click();
  await dialog.getByLabel(b.date).fill('2030-01-15');
  await dialog.getByRole('button', { name: new Date(SLOT).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }).click();
  await dialog.getByLabel(b.firstName).fill('Ivan');
  await dialog.getByLabel(b.lastName).fill('Petrov');
  await dialog.getByLabel(b.phone).fill('+10000000000');
  const submit = dialog.getByRole('button', { name: b.submit, exact: true });
  await submit.click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog.getByText('XYZ-789', { exact: true })).toBeVisible();
});

test('a page with an unknown slug tells the visitor it was not found', async ({ page }) => {
  await page.route('**/api/public-pages/by-slug/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found' }) }));
  await page.goto('/no-such-page');
  await expect(page.getByRole('main')).not.toBeEmpty();
  await expect(page.locator('[data-block-type]')).toHaveCount(0);
});
