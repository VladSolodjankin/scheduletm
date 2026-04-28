import { test, expect } from '@playwright/test';
import { creds, login } from './helpers/auth.mjs';

test.describe('web ui e2e: session', () => {
  test('user can logout from profile menu', async ({ page }) => {
    const owner = creds('E2E_OWNER');
    test.skip(!owner.email || !owner.password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for UI e2e.');

    await login(page, owner);

    await page.getByLabel('Open profile menu').click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  });
});
