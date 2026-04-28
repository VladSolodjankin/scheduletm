import { test, expect } from '@playwright/test';
import { creds, login } from './helpers/auth.mjs';

test.describe('web ui e2e: users', () => {
  test('owner can create/edit/deactivate user via UI', async ({ page }) => {
    const owner = creds('E2E_OWNER');
    test.skip(!owner.email || !owner.password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for UI e2e.');

    await login(page, owner);

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/users$/);

    const randomSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e-client-${randomSuffix}@example.com`;

    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Role').click();
    await page.getByRole('option', { name: 'client' }).click();
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Client');
    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.locator('tr', { hasText: email });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Edit user' }).click();
    await expect(row).toContainText('Client Updated');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('tr', { hasText: 'Client Updated' })).toBeVisible();

    await row.getByRole('button', { name: 'Deactivate user' }).click();
    await expect(row).toBeVisible();
  });
});
