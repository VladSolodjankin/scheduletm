import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { createZoomOAuthState, consumeZoomOAuthState } from '../repositories/zoomOAuthStateRepository.js';
import { clearWebUserZoomCredentials, updateWebUserZoomIntegration } from '../repositories/webUserIntegrationRepository.js';

type ZoomTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

const ZOOM_AUTH_BASE_URL = 'https://zoom.us/oauth/authorize';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_DEFAULT_SCOPES = ['meeting:write:meeting', 'meeting:read:meeting'];

const resolveTokenExpiresAt = (expiresIn: number) => new Date(Date.now() + expiresIn * 1000);

const hasValidRedirectUri = () => {
  try {
    const redirectUrl = new URL(env.ZOOM_OAUTH_REDIRECT_URI);
    const apiBaseUrl = new URL(env.API_BASE_URL);

    const isExpectedPath = redirectUrl.pathname === '/api/integrations/zoom/oauth/callback';
    const isSameOriginAsApi = redirectUrl.origin === apiBaseUrl.origin;
    const isAllowedProtocol = env.PORT === 3003
      ? redirectUrl.protocol === 'http:' || redirectUrl.protocol === 'https:'
      : redirectUrl.protocol === 'https:';

    return isExpectedPath && isSameOriginAsApi && isAllowedProtocol;
  } catch {
    return false;
  }
};

const isZoomOAuthConfigured = () => {
  return Boolean(
    env.ZOOM_OAUTH_CLIENT_ID &&
      env.ZOOM_OAUTH_CLIENT_SECRET &&
      env.ZOOM_OAUTH_REDIRECT_URI &&
      hasValidRedirectUri(),
  );
};

export const createZoomOAuthUrl = async (userId: string) => {
  if (!isZoomOAuthConfigured()) {
    return null;
  }

  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return null;
  }

  const accountId = await getDefaultAccountId();
  const state = randomBytes(32).toString('hex');

  await createZoomOAuthState({
    accountId,
    webUserId,
    stateToken: state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const params = new URLSearchParams({
    client_id: env.ZOOM_OAUTH_CLIENT_ID,
    redirect_uri: env.ZOOM_OAUTH_REDIRECT_URI,
    response_type: 'code',
    state,
    scope: env.ZOOM_OAUTH_SCOPES || ZOOM_DEFAULT_SCOPES.join(' '),
  });

  return {
    url: `${ZOOM_AUTH_BASE_URL}?${params.toString()}`,
    state,
  };
};

export const completeZoomOAuth = async (state: string, code: string) => {
  if (!isZoomOAuthConfigured()) {
    return { ok: false as const, reason: 'zoom_oauth_not_configured' };
  }

  const accountId = await getDefaultAccountId();
  const pending = await consumeZoomOAuthState(accountId, state);
  if (!pending) {
    return { ok: false as const, reason: 'invalid_state' };
  }

  try {
    const payload = new URLSearchParams({
      code,
      client_id: env.ZOOM_OAUTH_CLIENT_ID,
      client_secret: env.ZOOM_OAUTH_CLIENT_SECRET,
      redirect_uri: env.ZOOM_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await axios.post<ZoomTokenResponse>(ZOOM_TOKEN_URL, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    await updateWebUserZoomIntegration({
      accountId,
      webUserId: pending.web_user_id,
      zoomAccessToken: tokenResponse.data.access_token,
      zoomRefreshToken: tokenResponse.data.refresh_token,
      zoomTokenExpiresAt: resolveTokenExpiresAt(tokenResponse.data.expires_in),
      zoomConnectedAt: new Date(),
    });

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'token_exchange_failed' };
  }
};

export const disconnectZoomOAuth = async (userId: string) => {
  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return false;
  }

  const accountId = await getDefaultAccountId();
  await clearWebUserZoomCredentials(accountId, webUserId);
  return true;
};
