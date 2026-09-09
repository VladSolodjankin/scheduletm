import { expect, test } from '@playwright/test';
import { PUBLIC_PAGE_TEMPLATES } from '../../../src/features/public-page-builder/templates/index.ts';
import { applyPublicPageThemeColors, PUBLIC_PAGE_THEMES } from '../../../src/features/public-page-builder/config/themes.ts';

const PAGE_ID = 'a1294860-b166-4a9e-8985-0c26ef6a2261';
const services = [
  { id: 101, name: 'Individual consultation', description: 'A personal session to discuss your goals and the next steps.', price: 2500, durationMin: 60, currency: 'RUB', firstSessionFree: true, imageUrl: null },
  { id: 102, name: 'Follow-up consultation', description: 'Review progress and choose a convenient time for the next meeting.', price: 1800, durationMin: 45, currency: 'RUB', firstSessionFree: false, imageUrl: null },
];

async function mockPublicPage(page, theme = PUBLIC_PAGE_THEMES[5]) {
  const draft = PUBLIC_PAGE_TEMPLATES.find(({ id }) => id === 'beauty').createDocument(PAGE_ID);
  draft.slug = 'design-preview';
  draft.theme = structuredClone(theme);
  draft.sections[0].blocks[0].content.heading = 'Лилия — консультации';
  draft.sections[0].blocks[0].content.subtitle = 'Помогаю разобраться в целях и выбрать следующие шаги';
  draft.sections[1].blocks[0].content.serviceIds = services.map(({ id }) => id);
  draft.sections[1].blocks[0].content.autoplayIntervalSeconds = 5;
  const state = {
    record: { id: PAGE_ID, draft, published: { ...structuredClone(draft), status: 'published' }, status: 'published', revision: 1, createdAt: draft.createdAt, updatedAt: draft.updatedAt, publishedAt: draft.createdAt, archivedAt: null },
    saves: [],
    unexpected: [],
  };
  await page.addInitScript(() => {
    localStorage.setItem('ui-locale', 'en');
    localStorage.setItem('scheduletm_access_token', 'mock-token');
    localStorage.setItem('scheduletm_auth_user', JSON.stringify({ id: 'mock-admin', email: 'admin@example.test', role: 'admin', fullName: 'Test Admin' }));
  });
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'PUT' && path === '/api/settings/user') { return json({}); }
    if (method === 'GET' && path === '/api/services') {
      return json({ specialists: [{ id: 1, name: 'Specialist', isActive: true }], services: services.map((service) => ({ ...service, basePrice: service.price, baseDurationMinutes: service.durationMin, isActive: true, imageMediaId: null, assignments: [{ specialistId: 1, specialistName: 'Specialist', isActive: true, priceOverride: null, durationOverrideMinutes: null }] })) });
    }
    if (method === 'GET' && path === '/api/public-pages/slug-availability') { return json({ slug: url.searchParams.get('slug'), available: true }); }
    if (method === 'GET' && path === `/api/public-pages/${PAGE_ID}`) { return json(state.record); }
    if (method === 'GET' && path === '/api/public-pages/by-slug/design-preview') { return json(state.record.published); }
    if (method === 'GET' && path === '/api/public-pages/by-slug/design-preview/booking-options') { return json({ services, specialists: [] }); }
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

async function screenshot(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test('desktop editor keeps theme changes, undo/redo, save and block cancellation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1200 });
  const state = await mockPublicPage(page);
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await screenshot(page, testInfo, 'editor-desktop');
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Design', exact: true });
  await expect(dialog.getByRole('button', { name: 'z106', exact: true })).toBeVisible();
  await screenshot(page, testInfo, 'design-dialog');
  await dialog.getByRole('button', { name: 'z103', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.document.theme.id).toBe('z103');
  expect(state.saves.at(-1).document.sections).toEqual(state.record.published.sections);
  await page.getByRole('button', { name: 'Add block', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add block', exact: true });
  await add.getByRole('button', { name: 'Button', exact: true }).click();
  const block = page.getByRole('dialog', { name: 'Configure block', exact: true });
  await screenshot(page, testInfo, 'block-dialog');
  await block.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(block).not.toBeVisible();
  await add.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => state.saves.at(-1)?.document.sections.length).toBe(2);
  expect(state.unexpected).toEqual([]);
});

test('compact editor keeps actions reachable and does not overflow at 390 and 320 pixels', async ({ page }, testInfo) => {
  await mockPublicPage(page, PUBLIC_PAGE_THEMES[8]);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/public-pages/${PAGE_ID}/edit`);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    for (const name of ['Save', 'Publish', 'Undo', 'Redo', 'Page settings', 'Design', 'Add block', 'Copy link']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    await expect(page.getByRole('link', { name: 'Open', exact: true })).toHaveAttribute('href', /design-preview/);
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Design', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
    await screenshot(page, testInfo, `editor-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('published service cards preserve palettes, custom colors and carousel navigation', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const state = await mockPublicPage(page);
  const custom = applyPublicPageThemeColors(PUBLIC_PAGE_THEMES[0], {
    background: '#243340', surface: '#344554', text: '#f2f4f8', primary: '#729fcf',
  });
  for (const theme of [...PUBLIC_PAGE_THEMES, custom]) {
    state.record.published.theme = structuredClone(theme);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/design-preview');
    const region = page.locator('[role="region"][aria-label="Services"]');
    await expect(region).toBeVisible();
    expect((await region.evaluate((element) => getComputedStyle(element).getPropertyValue('--page-background'))).trim().toLowerCase()).toBe(theme.colors.background.toLowerCase());
    const cardContent = region.locator('.MuiCardContent-root').first();
    await expect(cardContent).toHaveCSS('flex-direction', 'row');
    const secondDot = region.locator('[data-service-dot]').nth(1);
    await secondDot.click();
    await expect(secondDot).toHaveAttribute('aria-current', 'true');
    await expect(region.getByRole('link', { name: 'Book', exact: true })).toHaveAttribute('href', '/design-preview/booking?service=102');
    await secondDot.press('Home');
    await expect(region.locator('[data-service-dot]').first()).toHaveAttribute('aria-current', 'true');
    await expect(region.getByRole('link', { name: 'Book', exact: true })).toHaveAttribute('href', '/design-preview/booking?service=101');
    await expect.poll(async () => Math.abs((await region.locator('.MuiCard-root').first().boundingBox()).x - (await region.boundingBox()).x)).toBeLessThan(2);
    if (theme.id === 'z106' || theme.id === 'custom') { await screenshot(page, testInfo, `published-${theme.id}`); }
  }
  await page.setViewportSize({ width: 375, height: 844 });
  const region = page.locator('[role="region"][aria-label="Services"]');
  await expect(region.locator('.MuiCardContent-root').first()).toHaveCSS('flex-direction', 'column');
  await region.locator('[data-service-dot]').nth(1).click();
  await expect(region.getByRole('link', { name: 'Book', exact: true })).toHaveAttribute('href', '/design-preview/booking?service=102');
  await screenshot(page, testInfo, 'published-mobile-custom');
  expect(state.unexpected).toEqual([]);
});

test('service images and autoplay survive responsive layout and the editor keeps its own theme boundary', async ({ page }, testInfo) => {
  const custom = applyPublicPageThemeColors(PUBLIC_PAGE_THEMES[0], {
    background: '#243340', surface: '#344554', text: '#f2f4f8', primary: '#729fcf',
  });
  const state = await mockPublicPage(page, custom);
  await page.route('**/booking-options', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ services: services.map((service, index) => ({ ...service, imageUrl: index === 0 ? 'https://images.example.test/service.png' : null })), specialists: [] }),
  }));
  await page.route('https://images.example.test/service.png', (route) => route.fulfill({
    contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  }));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/design-preview');
  const region = page.locator('[role="region"][aria-label="Services"]');
  const serviceImage = region.locator('.MuiCard-root img').first();
  await expect(serviceImage).toBeVisible();
  expect((await serviceImage.boundingBox()).width).toBeLessThan((await region.locator('.MuiCard-root').first().boundingBox()).width / 2);
  await expect(region.locator('[data-service-dot]').nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 9000 });
  await region.getByRole('button', { name: 'Pause autoplay', exact: true }).click();
  await expect(region.getByRole('button', { name: 'Start autoplay', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(region.locator('.MuiCardContent-root').first()).toHaveCSS('flex-direction', 'column');
  await screenshot(page, testInfo, 'custom-mobile');
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  const preview = page.getByRole('region', { name: 'Preview', exact: true });
  const content = preview.locator('.MuiCardContent-root').first();
  await expect(content).toHaveCSS('flex-direction', 'column');
  const background = await content.evaluate((element) => getComputedStyle(element).getPropertyValue('--page-background'));
  await page.getByRole('button', { name: 'Toggle theme mode', exact: true }).click();
  expect(await content.evaluate((element) => getComputedStyle(element).getPropertyValue('--page-background'))).toBe(background);
  await page.getByRole('button', { name: 'Tablet', exact: true }).click();
  await expect(content).toHaveCSS('flex-direction', 'row');
  await screenshot(page, testInfo, 'editor-tablet-dark-custom');
  expect(state.unexpected).toEqual([]);
});
