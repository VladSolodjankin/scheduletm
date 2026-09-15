import { expect, test } from '@playwright/test';
import { creds, login } from './helpers/auth.mjs';

const PAGE_ID = process.env.E2E_PUBLIC_PAGE_ID;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVRIiWPwyO6gKWIYtSB7NIg6RlORx2hG6xgtKjxGS9Ps0QrHY7TKzB5tVXSMNryyR5uOHYO6dQ0Ai7nsPZIP6tUAAAAASUVORK5CYII=', 'base64');

test('live design persists background images', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_PUBLIC_PAGE_LIVE !== '1' || !PAGE_ID, 'Requires an explicitly designated test draft and live credentials.');
  test.setTimeout(120_000);
  await login(page, creds('E2E_OWNER'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/public-pages/${PAGE_ID}/edit`);
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Design', exact: true });
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.getByText('Text contrast', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'z109', exact: true }).click();
  const uploadBackground = page.waitForResponse((response) => response.url().endsWith('/api/public-pages/media') && response.request().method() === 'POST');
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'background-test.png', mimeType: 'image/png', buffer: PNG });
  const backgroundResponse = await uploadBackground;
  expect(backgroundResponse.status(), await backgroundResponse.text()).toBe(201);
  await expect(dialog.getByRole('progressbar')).not.toBeVisible();
  await dialog.getByRole('textbox', { name: 'Focal point', exact: true }).fill('100% 100%');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const saveResponse = page.waitForResponse((response) => response.url().endsWith(`/api/public-pages/${PAGE_ID}/draft`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saveResponse).status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const reopened = page.getByRole('dialog', { name: 'Design', exact: true });
  await expect(reopened.getByRole('textbox', { name: 'Focal point', exact: true })).toHaveValue('100% 100%');
  await expect.poll(() => reopened.locator('img').evaluateAll((images) => images.some((image) => image.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('live-reloaded.png'), fullPage: true });
});
