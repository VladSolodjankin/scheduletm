import { expect } from '@playwright/test';

export function creds(prefix) {
  return {
    email: process.env[`${prefix}_EMAIL`] ?? '',
    password: process.env[`${prefix}_PASSWORD`] ?? '',
  };
}

export async function login(page, { email, password }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ui-locale', 'en');
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/appointments$/);
}
