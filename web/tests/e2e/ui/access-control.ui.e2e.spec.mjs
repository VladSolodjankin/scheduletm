import { test, expect } from '@playwright/test';
import { creds, loggedInRole, login } from './helpers/auth.mjs';

test.describe('web ui e2e: page access control', () => {
  test('owner can open specialists and notification logs pages directly', async ({ page }) => {
    const owner = creds('E2E_OWNER');
    test.skip(!owner.email || !owner.password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for UI e2e.');

    await login(page, owner);

    await page.goto('/specialists');
    await expect(page).toHaveURL(/\/specialists$/);
    await expect(page.getByRole('heading', { name: 'Specialists' })).toBeVisible();

    await page.goto('/notification-logs');
    await expect(page).toHaveURL(/\/notification-logs$/);
    await expect(page.getByRole('heading', { name: 'Notification logs' })).toBeVisible();
  });

  test('client sees access denied on specialists and notification logs', async ({ page }) => {
    const client = creds('E2E_CLIENT');
    test.skip(!client.email || !client.password, 'Set E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD for UI e2e.');

    await login(page, client);

    await page.goto('/specialists');
    await expect(page).toHaveURL(/\/specialists$/);
    await expect(page.getByText('Only owner or admin can manage specialists.')).toBeVisible();

    await page.goto('/notification-logs');
    await expect(page).toHaveURL(/\/notification-logs$/);
    await expect(page.getByText('You do not have access to notification logs.')).toBeVisible();
  });

  test('admin sees access denied on error logs page', async ({ page }) => {
    const admin = creds('E2E_ADMIN');
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for UI e2e.');

    await login(page, admin);
    const role = await loggedInRole(page);
    test.skip(role !== 'admin', `E2E_ADMIN credentials resolved to role "${role ?? 'unknown'}", expected "admin".`);

    await page.goto('/error-logs');
    await expect(page).toHaveURL(/\/error-logs$/);
    await expect(page.getByText('Only owner can view error logs.')).toBeVisible();
  });
});
