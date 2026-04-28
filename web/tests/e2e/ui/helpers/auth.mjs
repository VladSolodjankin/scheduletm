import { expect } from '@playwright/test';

const APP_ORIGIN = new URL(process.env.E2E_BASE_URL || 'http://localhost:5173').origin;
const E2E_API_URL = process.env.E2E_API_URL || process.env.VITE_API_URL || APP_ORIGIN;
const AUTH_TOKEN_KEY = 'scheduletm_access_token';
const AUTH_USER_KEY = 'scheduletm_auth_user';
const AUTH_REDIRECT_RE = new RegExp('\/(appointments|settings)$');
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

async function loginViaApi(page, { email, password }) {
  const endpoint = new URL('/api/auth/login', E2E_API_URL).toString();
  const timezone = 'UTC';

  const response = await page.request.post(endpoint, {
    data: { email, password, timezone },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    const responseText = (await response.text()).slice(0, 300);
    throw new Error(`E2E API login failed (${response.status()}) at ${endpoint}: ${responseText || 'empty response'}`);
  }

  const payload = await response.json();

  if (!payload?.accessToken || !payload?.user) {
    throw new Error(`E2E API login returned invalid payload at ${endpoint}`);
  }

  await page.addInitScript(({ token, user, tokenKey, userKey }) => {
    window.localStorage.setItem('ui-locale', 'en');
    window.localStorage.setItem(tokenKey, token);
    window.localStorage.setItem(userKey, JSON.stringify(user));
  }, {
    token: payload.accessToken,
    user: payload.user,
    tokenKey: AUTH_TOKEN_KEY,
    userKey: AUTH_USER_KEY,
  });

  await page.goto('/appointments');
  await expect(page).toHaveURL(AUTH_REDIRECT_RE);
}

export async function login(page, { email, password }) {
  const cacheKey = `${email}:${password}`;
  const cachedState = authStateCache.get(cacheKey);

  if (cachedState) {
    await applyCachedState(page, cachedState);
    await page.goto('/appointments');
    await expect(page).toHaveURL(AUTH_REDIRECT_RE);

    return;
  }

  await loginViaApi(page, { email, password });
  authStateCache.set(cacheKey, await page.context().storageState());
}
