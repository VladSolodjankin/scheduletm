import { test, expect } from '@playwright/test';
import { creds, login } from './helpers/auth.mjs';

const API_ORIGIN = process.env.E2E_API_URL || process.env.VITE_API_URL || process.env.E2E_BASE_URL || 'http://localhost:5173';
const AUTH_TOKEN_KEY = 'scheduletm_access_token';

test.describe('web ui e2e: users', () => {
  test('owner can create/edit/deactivate user via UI', async ({ page }) => {
    const owner = creds('E2E_OWNER');
    test.skip(!owner.email || !owner.password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for UI e2e.');

    await login(page, owner);

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/users$/);

    const randomSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e-client-${randomSuffix}@example.com`;
    let createdUserId = null;
    let testError = null;

    try {
      await page.getByRole('button', { name: 'Add user' }).click();
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Role').click();
      await page.getByRole('option', { name: 'client' }).click();
      await page.getByLabel('First name').fill('E2E');
      await page.getByLabel('Last name').fill('Client');

      const createResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' && url.pathname === '/api/users';
      });
      await page.getByRole('button', { name: 'Save' }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      const createdUser = await createResponse.json();
      createdUserId = createdUser.id;
      expect(createdUserId).toEqual(expect.any(Number));

      const row = page.getByTestId(`managed-user-${createdUserId}`);
      await expect(row).toBeVisible();
      await expect(row.getByText(email, { exact: true })).toBeVisible();

      await row.getByRole('button', { name: 'Edit user' }).click();
      await page.getByLabel('First name').fill('Client');
      await page.getByLabel('Last name').fill('Updated');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(row.getByText('Client Updated', { exact: true })).toBeVisible();

      await row.getByRole('button', { name: 'Deactivate user' }).click();
      const deactivateDialog = page.getByRole('dialog', { name: 'Deactivate user?' });
      await deactivateDialog.getByRole('button', { name: 'Deactivate', exact: true }).click();
      await expect(deactivateDialog).toBeHidden();
      await expect(row.getByText('Inactive', { exact: true })).toBeVisible();

      await row.getByRole('button', { name: 'Delete user' }).click();
      const deleteDialog = page.getByRole('dialog', { name: 'Delete user?' });
      await expect(deleteDialog.getByText('Total linked appointments: 0')).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Delete user', exact: true }).click();
      await expect(deleteDialog).toBeHidden();
      await expect(row).toHaveCount(0);
    } catch (error) {
      testError = error;
      throw error;
    } finally {
      if (createdUserId !== null) {
        try {
          const token = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_TOKEN_KEY);
          const cleanupResponse = await page.request.delete(
            new URL(`/api/users/${createdUserId}`, API_ORIGIN).toString(),
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!cleanupResponse.ok() && cleanupResponse.status() !== 404) {
            throw new Error(`Failed to clean up user ${createdUserId}: HTTP ${cleanupResponse.status()}`);
          }
        } catch (cleanupError) {
          if (!testError) {
            throw cleanupError;
          }
          console.warn(`Failed to clean up user ${createdUserId} after test failure:`, cleanupError);
        }
      }
    }
  });
});
