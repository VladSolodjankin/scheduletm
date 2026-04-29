import { test, expect } from '@playwright/test';

test.describe('web ui e2e: auth public flows', () => {
  test('user can switch between login and register screens', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

    await page.getByRole('button', { name: /Register/ }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();

    await page.getByRole('button', { name: /Sign in/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  });

  test('invite accept without token/email shows invalid invite state', async ({ page }) => {
    await page.goto('/invite/accept');
    await expect(page).toHaveURL(/\/invite\/accept$/);
    await expect(page.getByText('Invitation is invalid')).toBeVisible();
    await expect(page.getByText('This link has expired or has already been used.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request a new invitation' })).toBeDisabled();
  });

  test('verify-email route without token/email shows invalid invite state', async ({ page }) => {
    await page.goto('/verify-email');
    await expect(page).toHaveURL(/\/verify-email$/);
    await expect(page.getByText('Invitation is invalid')).toBeVisible();
    await expect(page.getByText('This link has expired or has already been used.')).toBeVisible();
  });
});
