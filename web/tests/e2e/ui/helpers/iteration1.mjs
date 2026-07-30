import { expect } from '@playwright/test';
import { loggedInRole, login } from './auth.mjs';

const AUTH_TOKEN_KEY = 'scheduletm_access_token';
const AUTH_USER_KEY = 'scheduletm_auth_user';
const API_ORIGIN = process.env.E2E_API_URL;

export function requireAdminCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password || !API_ORIGIN) {
    throw new Error(
      'Iteration-1 UI E2E requires E2E_API_URL, E2E_ADMIN_EMAIL, and E2E_ADMIN_PASSWORD.',
    );
  }

  return { email, password };
}

export async function loginAsAdminViaUi(page) {
  const { email, password } = requireAdminCredentials();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/appointments$/);

  const user = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, AUTH_USER_KEY);

  if (user?.role !== 'admin') {
    throw new Error(
      `E2E_ADMIN_EMAIL must belong to an admin account; received role "${user?.role ?? 'unknown'}".`,
    );
  }
}

export async function loginAsAdmin(page) {
  await login(page, requireAdminCredentials());
  const role = await loggedInRole(page);

  if (role !== 'admin') {
    throw new Error(
      `E2E_ADMIN_EMAIL must belong to an admin account; received role "${role ?? 'unknown'}".`,
    );
  }
}

export async function authToken(page) {
  const token = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error('Iteration-1 cleanup could not read the authenticated session token.');
  }
  return token;
}

export function runId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function apiRequest(page, method, path, data) {
  const token = await authToken(page);
  const response = await page.request.fetch(new URL(path, API_ORIGIN).toString(), {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(`E2E cleanup request failed: ${method} ${path} (${response.status()})`);
  }

  return response;
}
