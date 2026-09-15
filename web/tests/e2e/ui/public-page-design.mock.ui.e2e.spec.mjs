import { expect, test } from '@playwright/test';
import { PUBLIC_PAGE_TEMPLATES } from '../../../src/features/public-page-builder/templates/index.ts';
import { applyPublicPageThemeColors, PUBLIC_PAGE_THEMES } from '../../../src/features/public-page-builder/config/themes.ts';

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
    localStorage.setItem('scheduletm_access_token', 'mock-token');
    localStorage.setItem('scheduletm_auth_user', JSON.stringify({ id: 'mock-admin', email: 'admin@example.test', role: 'admin', fullName: 'Test Admin' }));
  }, locale);
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'PUT' && path === '/api/settings/user') { return json({}); }
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

async function screenshot(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

for (const width of [375, 1440]) {
  test(`service cards stay centered with neighboring edges at ${width}px`, async ({ page }) => {
    const catalog = Array.from({ length: 12 }, (_, index) => ({ ...services[index % 2], id: 101 + index }));
    const state = await mockPublicPage(page, PUBLIC_PAGE_THEMES[5], catalog);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const count of [1, 2, 3, 12]) {
      state.record.published.sections[1].blocks[0].content.serviceIds = catalog.slice(0, count).map(({ id }) => id);
      await page.goto('/design-preview');
      const region = page.locator('[role="region"][aria-label="Services"]');
      const cards = region.locator('.MuiCard-root');
      await expect(cards).toHaveCount(count);
      if (count === 1) {
        await expect(region.locator('[data-service-dot]')).toHaveCount(0);
        const card = await cards.first().boundingBox();
        const bounds = await region.boundingBox();
        expect(Math.abs(card.width - bounds.width)).toBeLessThan(2);
        continue;
      }
      const dots = region.locator('[data-service-dot]');
      for (const index of [...new Set([0, Math.floor(count / 2), count - 1])]) {
        await dots.nth(index).click();
        await expect(dots.nth(index)).toHaveAttribute('aria-current', 'true');
        await expect.poll(async () => {
          const card = await cards.nth(index).boundingBox();
          const bounds = await region.boundingBox();
          return Math.abs(card.x + card.width / 2 - bounds.x - bounds.width / 2);
        }).toBeLessThan(2);
        const card = await cards.nth(index).boundingBox();
        const bounds = await region.boundingBox();
        expect(card.width / bounds.width).toBeCloseTo(bounds.width >= 600 ? 0.72 : 0.88, 2);
        const firstDot = await dots.first().boundingBox();
        const lastDot = await dots.last().boundingBox();
        expect(Math.abs((firstDot.x + lastDot.x + lastDot.width) / 2 - bounds.x - bounds.width / 2)).toBeLessThan(2);
        if (width === 375) {
          const book = await region.getByRole('link', { name: 'Book', exact: true }).boundingBox();
          expect(Math.abs(book.x + book.width / 2 - bounds.x - bounds.width / 2)).toBeLessThan(2);
        }
        if (index < count - 1) {
          const next = await cards.nth(index + 1).boundingBox();
          expect(next.x).toBeLessThan(bounds.x + bounds.width);
          expect(next.x - card.x - card.width).toBeCloseTo(bounds.width >= 600 ? 20 : 10, 0);
        }
        if (index > 0) {
          const previous = await cards.nth(index - 1).boundingBox();
          expect(previous.x + previous.width).toBeGreaterThan(bounds.x);
        }
      }
      await dots.last().press('Home');
      await expect(dots.first()).toBeFocused();
      await dots.first().press('End');
      await expect(dots.last()).toBeFocused();
      if (count === 2 && process.env.E2E_VISUAL_DIR) {
        await dots.first().click();
        await page.screenshot({ path: `${process.env.E2E_VISUAL_DIR}/services-${width}.png`, fullPage: true });
      }
    }
    expect(state.unexpected).toEqual([]);
  });

}

for (const width of [320, 390, 768, 1440]) {
  test(`compact Add block overlay remains usable while preview scrolls at ${width}px`, async ({ page }) => {
    const state = await mockPublicPage(page);
    const section = state.record.draft.sections[1];
    for (let index = 0; index < 6; index += 1) {
      const copy = structuredClone(section);
      copy.id = `long-section-${index}`;
      copy.blocks.forEach((block) => { block.id = `long-block-${index}`; });
      state.record.draft.sections.push(copy);
    }
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/public-pages/${PAGE_ID}/edit`);
    const add = page.getByRole('button', { name: 'Add block', exact: true });
    const shell = page.locator('[data-public-page-add-block-shell]');
    const scroller = page.getByRole('region', { name: 'Preview', exact: true });
    const previewSurface = page.locator('.public-page-editor-preview-surface');
    await expect(add).toBeInViewport({ ratio: 1 });
    await expect(shell).toHaveCSS('height', '52px');
    await expect(add).toHaveCSS('min-height', '44px');
    const initial = await shell.boundingBox();
    const initialPreview = await scroller.boundingBox();
    const initialSurface = await previewSurface.boundingBox();
    expect(initial.width).toBeLessThanOrEqual(216);
    expect(initial.width).toBeLessThanOrEqual(initialPreview.width - 32 + 1);
    await expect.poll(async () => {
      const shellBounds = await shell.boundingBox();
      const surfaceBounds = await previewSurface.boundingBox();
      return Math.abs(shellBounds.x + shellBounds.width / 2 - surfaceBounds.x - surfaceBounds.width / 2);
    }).toBeLessThan(2);
    expect(Math.abs(initial.y + initial.height - (initialPreview.y + initialPreview.height - 16))).toBeLessThan(2);
    const scrollOwners = await page.evaluate(() => [...document.querySelectorAll('*')]
      .filter((element) => element.scrollHeight > element.clientHeight + 1 && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY))
      .map((element) => element.hasAttribute('data-public-page-preview-scroller') ? 'preview' : element.tagName.toLowerCase()));
    expect(scrollOwners).toEqual(['preview']);
    await scroller.evaluate((element) => { element.scrollTop = 0; });
    await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
    await page.mouse.wheel(0, 360);
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    for (const ratio of [0.5, 1]) {
      await scroller.evaluate((element, fraction) => { element.scrollTop = fraction * element.scrollHeight; }, ratio);
      await expect(add).toBeInViewport({ ratio: 1 });
      const bounds = await shell.boundingBox();
      const previewBounds = await scroller.boundingBox();
      const surfaceBounds = await previewSurface.boundingBox();
      expect(Math.abs(bounds.y - initial.y)).toBeLessThan(1);
      expect(bounds.y).toBeGreaterThan(previewBounds.y);
      expect(bounds.y + bounds.height).toBeLessThan(previewBounds.y + previewBounds.height);
      expect(Math.abs(bounds.x + bounds.width / 2 - surfaceBounds.x - surfaceBounds.width / 2)).toBeLessThan(2);
    }
    expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
    const lastBlock = scroller.locator('[data-editor-block-id]').last();
    const lastBlockBounds = await lastBlock.boundingBox();
    const shellBounds = await shell.boundingBox();
    expect(lastBlockBounds.y + lastBlockBounds.height).toBeLessThanOrEqual(shellBounds.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await add.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Add block', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(add).toBeFocused();
    await add.click();
    await page.getByRole('dialog', { name: 'Add block', exact: true }).getByRole('button', { name: 'Button', exact: true }).click();
    const configure = page.getByRole('dialog', { name: 'Configure block', exact: true });
    await configure.getByRole('button', { name: 'Save', exact: true }).click();
    const addedBlock = scroller.locator('[data-editor-block-id]').last();
    await expect(addedBlock).toBeVisible();
    await expect.poll(async () => {
      const blockBounds = await addedBlock.boundingBox();
      const floatingBounds = await shell.boundingBox();
      return (blockBounds?.y ?? Infinity) + (blockBounds?.height ?? Infinity) <= (floatingBounds?.y ?? -Infinity);
    }).toBe(true);
    if (process.env.E2E_VISUAL_DIR) {
      await page.screenshot({ path: `${process.env.E2E_VISUAL_DIR}/editor-add-block-overlay-${width}.png`, fullPage: true });
    }
    expect(state.unexpected).toEqual([]);
  });
}

test('service autoplay wraps after the centered last card and respects reduced motion', async ({ page }) => {
  const state = await mockPublicPage(page);
  state.record.published.sections[1].blocks[0].content.autoplayIntervalSeconds = 3;
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/design-preview');
  await expect(page.getByRole('button', { name: 'Pause autoplay', exact: true })).toBeVisible();
  const dots = page.locator('[data-service-dot]');
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await expect(dots.last()).toHaveAttribute('aria-current', 'true');
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Pause autoplay', exact: true })).toHaveCount(0);
  await page.waitForTimeout(3300);
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  expect(state.unexpected).toEqual([]);
});

test('twelve service dots and autoplay control fit narrow mobile cards', async ({ page }) => {
  const catalog = Array.from({ length: 12 }, (_, index) => ({ ...services[index % 2], id: 101 + index }));
  await mockPublicPage(page, PUBLIC_PAGE_THEMES[5], catalog);
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/design-preview');
    const region = page.locator('[role="region"][aria-label="Services"]');
    const pause = region.getByRole('button', { name: 'Pause autoplay', exact: true });
    await expect(pause).toBeVisible();
    const bounds = await region.boundingBox();
    const pauseBounds = await pause.boundingBox();
    expect(pauseBounds.x + pauseBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  }
});

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
    for (const device of ['Desktop', 'Tablet', 'Mobile']) {
      const control = page.getByRole('button', { name: device, exact: true });
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('button', { name: 'Desktop', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Tablet', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mobile', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Mobile', exact: true })).toHaveAttribute('aria-pressed', 'true');
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

test('dirty Russian status remains bounded at 320 pixels', async ({ page }) => {
  await mockPublicPage(page, PUBLIC_PAGE_THEMES[5], services, 'ru');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('button', { name: 'Дизайн', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Дизайн', exact: true });
  await dialog.getByRole('button', { name: 'z103', exact: true }).click();
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  const label = 'Есть несохранённые изменения';
  const status = page.locator(`[aria-label="${label}"]`);
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('title', label);
  const bounds = await status.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
    await expect.poll(async () => {
      const card = await region.locator('.MuiCard-root').first().boundingBox();
      const viewport = await region.boundingBox();
      return Math.abs(card.x + card.width / 2 - viewport.x - viewport.width / 2);
    }).toBeLessThan(2);
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
  await expect(page.getByRole('button', { name: 'Desktop', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(content).toHaveCSS('flex-direction', 'row');
  const background = await content.evaluate((element) => getComputedStyle(element).getPropertyValue('--page-background'));
  await page.evaluate(() => localStorage.setItem('ui-theme-mode', 'dark'));
  await page.reload();
  expect(await content.evaluate((element) => getComputedStyle(element).getPropertyValue('--page-background'))).toBe(background);
  await page.getByRole('button', { name: 'Tablet', exact: true }).click();
  await expect(content).toHaveCSS('flex-direction', 'row');
  await screenshot(page, testInfo, 'editor-tablet-dark-custom');
  expect(state.unexpected).toEqual([]);
});
