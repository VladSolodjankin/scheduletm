import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { createYandexOAuthState, consumeYandexOAuthState } from '../repositories/yandexOAuthStateRepository.js';
import { clearWebUserYandexCredentials, updateWebUserYandexIntegration } from '../repositories/webUserIntegrationRepository.js';

type YandexTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

const YANDEX_AUTH_BASE_URL = 'https://oauth.yandex.ru/authorize';
const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_DEFAULT_SCOPES = ['telemost-api:conferences.create'];
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

const hasValidRedirectUri = () => {
  try {
    const redirectUrl = new URL(env.YANDEX_OAUTH_REDIRECT_URI);
    const apiBaseUrl = new URL(env.API_BASE_URL);

    const isExpectedPath = redirectUrl.pathname === '/api/integrations/yandex/oauth/callback';
    const isSameOriginAsApi = redirectUrl.origin === apiBaseUrl.origin;
    const isAllowedProtocol = env.PORT === 3003
      ? redirectUrl.protocol === 'http:' || redirectUrl.protocol === 'https:'
      : redirectUrl.protocol === 'https:';

    return isExpectedPath && isSameOriginAsApi && isAllowedProtocol;
  } catch {
    return false;
  }
};

const isYandexOAuthConfigured = () => Boolean(
  env.YANDEX_OAUTH_CLIENT_ID
  && env.YANDEX_OAUTH_CLIENT_SECRET
  && env.YANDEX_OAUTH_REDIRECT_URI
  && hasValidRedirectUri(),
);

export const createYandexOAuthUrl = async (userId: string, accountId: number) => {
  if (!isYandexOAuthConfigured()) {
    return null;
  }

  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return null;
  }

  const state = randomBytes(32).toString('hex');

  await createYandexOAuthState({
    accountId,
    webUserId,
    stateToken: state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.YANDEX_OAUTH_CLIENT_ID,
    redirect_uri: env.YANDEX_OAUTH_REDIRECT_URI,
    scope: env.YANDEX_OAUTH_SCOPES || YANDEX_DEFAULT_SCOPES.join(' '),
    state,
  });

  return {
    url: `${YANDEX_AUTH_BASE_URL}?${params.toString()}`,
    state,
  };
};

export const completeYandexOAuth = async (state: string, code: string) => {
  if (!isYandexOAuthConfigured()) {
    return { ok: false as const, reason: 'yandex_oauth_not_configured' };
  }

  const pending = await consumeYandexOAuthState(state);
  if (!pending) {
    return { ok: false as const, reason: 'invalid_state' };
  }

  try {
    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.YANDEX_OAUTH_CLIENT_ID,
      client_secret: env.YANDEX_OAUTH_CLIENT_SECRET,
    });

    const tokenResponse = await axios.post<YandexTokenResponse>(YANDEX_TOKEN_URL, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    await updateWebUserYandexIntegration({
      accountId: pending.account_id,
      webUserId: pending.web_user_id,
      yandexAccessToken: tokenResponse.data.access_token,
      yandexRefreshToken: tokenResponse.data.refresh_token,
      yandexTokenExpiresAt: new Date(
        Date.now() + (tokenResponse.data.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS) * 1000,
      ),
      yandexConnectedAt: new Date(),
    });

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'token_exchange_failed' };
  }
};

export const disconnectYandexOAuth = async (userId: string, accountId: number) => {
  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return false;
  }

  await clearWebUserYandexCredentials(accountId, webUserId);
  return true;
};
