import { expect, test } from '@playwright/test';
import { PUBLIC_PAGE_TEMPLATES } from '../../../src/features/public-page-builder/templates/index.ts';

const services = [
  { id: 101, name: 'Individual consultation', description: 'A personal session to discuss your goals.', price: 2500, durationMin: 60, currency: 'RUB', firstSessionFree: true, imageUrl: null },
  { id: 102, name: 'Follow-up consultation', description: 'Review progress and choose the next steps.', price: 1800, durationMin: 45, currency: 'RUB', firstSessionFree: false, imageUrl: null },
];
const viewports = [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];

/** Serves `document` as the published page `/preview` with a fixed catalog of services and no reviews. */
async function mockPublishedPage(page, document) {
  const published = { ...structuredClone(document), slug: 'preview', status: 'published' };
  await page.addInitScript(() => { localStorage.setItem('ui-locale', 'ru'); });
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/public-pages/by-slug/preview') { return json(published); }
    if (path === '/api/public-pages/by-slug/preview/booking-options') { return json({ services, specialists: [] }); }
    if (path === '/api/public-pages/by-slug/preview/reviews') { return json({ reviews: [], summary: { average: null, count: 0 } }); }
    if (path === '/api/public-pages/by-slug/preview/events') { return route.fulfill({ status: 204 }); }
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'unexpected_mock_request', path }) });
  });
}

async function openPreview(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/preview');
  await page.locator('[data-block-type]').first().waitFor();
  await page.waitForLoadState('networkidle');
  // A fixed button would land in the middle of full-page captures.
  await page.addStyleTag({ content: '[data-sticky-book] { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const templates = PUBLIC_PAGE_TEMPLATES.filter(({ id }) => id !== 'blank');

for (const template of templates) {
  for (const viewport of viewports) {
    test(`template ${template.id} renders every block without overflow at ${viewport.name}`, async ({ page }) => {
      const document = template.createDocument('visual-check', '2026-01-01T00:00:00.000Z', 'ru');
      for (const section of document.sections) {
        for (const block of section.blocks) {
          if (block.type === 'services') { block.content.serviceIds = services.map(({ id }) => id); }
        }
      }
      await mockPublishedPage(page, document);
      await openPreview(page, viewport);
      const visibleBlocks = document.sections.filter((section) => section.visible).flatMap((section) => section.blocks.filter((block) => block.visible && block.type !== 'reviews'));
      // Reviews stay hidden until the page has some; the mock serves none.
      await expect(page.locator('[data-block-type]')).toHaveCount(visibleBlocks.length);
      await expectNoHorizontalOverflow(page);
      await expect(page).toHaveScreenshot(`template-${template.id}-${viewport.name}.png`, { fullPage: true, maxDiffPixelRatio: 0.01 });
    });
  }
}

test('every content block renders in its own right and the video is embedded from a trusted host', async ({ page }) => {
  const document = PUBLIC_PAGE_TEMPLATES.find(({ id }) => id === 'specialist').createDocument('content-blocks', '2026-01-01T00:00:00.000Z', 'ru');
  const section = structuredClone(document.sections[0]);
  section.design.variant = 'off';
  const items = (fields) => [{ id: 'row-1', ...fields }, { id: 'row-2', ...fields }];
  const contents = {
    'price-list': { title: 'Цены', items: items({ title: 'Консультация', description: 'Разбор запроса и план работы', price: '50 €' }) },
    steps: { title: 'Как это работает', items: items({ title: 'Напишите мне', description: 'Расскажите, с чем нужна помощь.' }) },
    stats: { title: '', items: items({ value: '10+', description: 'лет опыта' }) },
    hours: { title: 'График работы', items: items({ days: 'Пн-Пт', hours: '10:00-19:00' }) },
    video: { title: '', url: 'https://youtu.be/dQw4w9WgXcQ' },
    faq: { title: 'Частые вопросы', items: items({ title: 'Сколько длится сессия?', description: 'Около часа.' }) },
  };
  section.blocks = Object.entries(contents).map(([type, content]) => ({ ...structuredClone(document.sections[0].blocks[0]), id: `block-${type}`, type, name: type, content }));
  document.sections = [section];
  await mockPublishedPage(page, document);
  for (const viewport of viewports) {
    await openPreview(page, viewport);
    await expect(page.locator('[data-block-type]')).toHaveCount(6);
    await expect(page.locator('[data-block-type="steps"] ol > li')).toHaveCount(2);
    await expect(page.locator('[data-block-type="hours"] dt')).toHaveCount(2);
    await expect(page.locator('[data-block-type="video"] iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(`content-blocks-${viewport.name}.png`, { fullPage: true, maxDiffPixelRatio: 0.01, mask: [page.locator('iframe')] });
  }
});

test('the page speaks its own language, not the visitor language', async ({ page }) => {
  for (const [locale, bookLabel] of [['en', 'Book'], ['ru', 'Записаться']]) {
    const document = PUBLIC_PAGE_TEMPLATES.find(({ id }) => id === 'specialist').createDocument('language-check', '2026-01-01T00:00:00.000Z', locale);
    document.locale = locale;
    document.sections.flatMap((section) => section.blocks).forEach((block) => { if (block.type === 'services') { block.content.serviceIds = [101]; } });
    // The visitor's browser is Russian; the page is in `locale`.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockPublishedPage(page, document);
    await openPreview(page, viewports[1]);
    await expect(page.getByRole('button', { name: bookLabel, exact: true }).first()).toBeVisible();
  }
});
