import { expect, test } from '@playwright/test';
import {
  apiRequest,
  loginAsAdmin,
  loginAsAdminViaUi,
  requireAdminCredentials,
  runId,
} from './helpers/iteration1.mjs';

test.describe('iteration 1: admin browser flows', () => {
  test.beforeAll(() => {
    requireAdminCredentials();
  });

  test('real UI login, protected session, and logout', async ({ page }) => {
    await loginAsAdminViaUi(page);
    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/appointments$/);

    await page.getByLabel('Open profile menu').click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('updates and restores specialist schedule settings', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/specialists');
    const specialist = page.locator('main').getByRole('button').filter({ hasText: 'Timezone:' }).first();
    await expect(specialist, 'A seeded specialist is required for schedule E2E.').toBeVisible();
    await specialist.click();

    const dialog = page.getByRole('dialog', { name: 'Edit specialist' });
    const start = dialog.getByLabel('Work start hour');
    const original = await start.inputValue();
    const changed = original === '8' ? '9' : '8';

    try {
      await start.fill(changed);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      await specialist.click();
      await expect(dialog.getByLabel('Work start hour')).toHaveValue(changed);
    } finally {
      if (await dialog.isHidden()) {
        await specialist.click();
      }
      await dialog.getByLabel('Work start hour').fill(original);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
    }
  });

  test('creates, saves, publishes, views, archives, and deletes a Public Page', async ({ page }) => {
    await loginAsAdmin(page);
    const slugMarker = runId('e2e-page').toLowerCase();
    let pageId = '';

    try {
      await page.goto('/public-pages');
      await page.getByRole('button', { name: 'Create page' }).click();
      const createDialog = page.getByRole('dialog', { name: 'Create page' });
      await createDialog.getByLabel('Template').click();
      await page.getByRole('option', { name: 'Small business' }).click();

      const createResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/public-pages',
      );
      await createDialog.getByRole('button', { name: 'Create page' }).click();
      const createResponse = await createResponsePromise;
      const created = await createResponse.json();
      pageId = created.id;

      await expect(page).toHaveURL(/\/public-pages\/[^/]+\/edit$/);
      const slug = page.getByLabel('Slug');
      await slug.fill(slugMarker);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Saved', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Publish' }).click();
      await expect(page.getByRole('button', { name: 'Open' })).toBeVisible();

      const publicPage = await page.context().newPage();
      await publicPage.goto(`/${slugMarker}`);
      await expect(publicPage.getByText('Our business')).toBeVisible();
      await publicPage.close();

      await page.goto('/public-pages');
      const card = page.locator('.MuiCard-root', { hasText: `/${slugMarker}` });
      await card.getByRole('button', { name: 'Archive' }).click();
      await expect(card.getByText('Archived')).toBeVisible();
      page.once('dialog', (dialog) => dialog.accept());
      await card.getByRole('button', { name: 'Delete' }).click();
      await expect(card).toHaveCount(0);
      pageId = '';
    } finally {
      if (pageId) {
        const current = await apiRequest(page, 'GET', `/api/public-pages/${encodeURIComponent(pageId)}`);
        const record = await current.json();
        if (record.status !== 'archived') {
          const archived = await apiRequest(
            page,
            'POST',
            `/api/public-pages/${encodeURIComponent(pageId)}/archive`,
            { expectedRevision: record.revision },
          );
          const archivedRecord = await archived.json();
          await apiRequest(
            page,
            'DELETE',
            `/api/public-pages/${encodeURIComponent(pageId)}`,
            { expectedRevision: archivedRecord.revision },
          );
        } else {
          await apiRequest(
            page,
            'DELETE',
            `/api/public-pages/${encodeURIComponent(pageId)}`,
            { expectedRevision: record.revision },
          );
        }
      }
    }
  });
});
