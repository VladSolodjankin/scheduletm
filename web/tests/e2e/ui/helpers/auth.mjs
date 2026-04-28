import { expect } from '@playwright/test';

const APP_ORIGIN = new URL(process.env.E2E_BASE_URL || 'http://localhost:5173').origin;
const authStateCache = new Map();

export function creds(prefix) {
  return {
    email: process.env[`${prefix}_EMAIL`] ?? '',
    password: process.env[`${prefix}_PASSWORD`] ?? '',
  };
}

async function applyCachedState(page, state) {
  if (state.cookies?.length) {
    await page.context().addCookies(state.cookies);
  }

  const appOriginState = state.origins?.find((originState) => originState.origin === APP_ORIGIN);
  const localStorageEntries = appOriginState?.localStorage ?? [];

  await page.addInitScript(({ entries }) => {
    window.localStorage.setItem('ui-locale', 'en');

    for (const { name, value } of entries) {
      window.localStorage.setItem(name, value);
    }
  }, { entries: localStorageEntries });
}

export async function login(page, { email, password }) {
  const cacheKey = `${email}:${password}`;
  const cachedState = authStateCache.get(cacheKey);

  if (cachedState) {
    await applyCachedState(page, cachedState);
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\\/(appointments|settings)$/);

    return;
  }

  await page.addInitScript(() => {
    window.localStorage.setItem('ui-locale', 'en');
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\\/(appointments|settings)$/);

  authStateCache.set(cacheKey, await page.context().storageState());
}
