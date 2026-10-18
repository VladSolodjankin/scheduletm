import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { createGoogleOAuthState, consumeGoogleOAuthState } from '../repositories/googleOAuthStateRepository.js';
import { hasGoogleCalendarWriteScope } from '../utils/googleScopes.js';
import {
  clearWebUserGoogleCredentials,
  updateWebUserGoogleCalendarWriteEnabled,
  updateWebUserGoogleCredentials,
} from '../repositories/webUserIntegrationRepository.js';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

type RefreshGoogleAccessTokenInput = {
  accountId: number;
  webUserId: number;
  refreshToken: string;
};

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DEFAULT_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.freebusy'
];

export type GoogleOAuthAccess = 'write';


const resolveTokenExpiresAt = (expiresIn: number) => {
  return new Date(Date.now() + expiresIn * 1000);
};


const hasValidRedirectUri = () => {
  try {
    const redirectUrl = new URL(env.GOOGLE_OAUTH_REDIRECT_URI);
    const apiBaseUrl = new URL(env.API_BASE_URL);

    const isExpectedPath = redirectUrl.pathname === '/api/integrations/google/oauth/callback';
    const isSameOriginAsApi = redirectUrl.origin === apiBaseUrl.origin;
    const isAllowedProtocol = env.PORT === 3003
      ? redirectUrl.protocol === 'http:' || redirectUrl.protocol === 'https:'
      : redirectUrl.protocol === 'https:';

    return isExpectedPath && isSameOriginAsApi && isAllowedProtocol;
  } catch {
    return false;
  }
};


const isGoogleOAuthConfigured = () => {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID &&
      env.GOOGLE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REDIRECT_URI &&
      hasValidRedirectUri()
  );
};

const resolveRequestedScopes = (access?: GoogleOAuthAccess) => {
  const scopes = (env.GOOGLE_OAUTH_SCOPES || GOOGLE_DEFAULT_SCOPES.join(' '))
    .split(/\s+/)
    .filter(Boolean);

  if (access === 'write' && env.GOOGLE_OAUTH_WRITE_SCOPE && !scopes.includes(env.GOOGLE_OAUTH_WRITE_SCOPE)) {
    scopes.push(env.GOOGLE_OAUTH_WRITE_SCOPE);
  }

  return scopes.join(' ');
};

export const createGoogleOAuthUrl = async (userId: string, accountId: number, access?: GoogleOAuthAccess) => {
  if (!isGoogleOAuthConfigured()) {
    return null;
  }

  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return null;
  }

  const state = randomBytes(32).toString('hex');

  await createGoogleOAuthState({
    accountId,
    webUserId,
    stateToken: state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    requestedAccess: access ?? null,
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    scope: resolveRequestedScopes(access),
    state,
    prompt: 'consent'
  });

  return {
    url: `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`,
    state
  };
};

export const completeGoogleOAuth = async (state: string, code: string) => {
  if (!isGoogleOAuthConfigured()) {
    return { ok: false as const, reason: 'google_oauth_not_configured' };
  }

  const pending = await consumeGoogleOAuthState(state);
  if (!pending) {
    return { ok: false as const, reason: 'invalid_state' };
  }

  const accountId = pending.account_id;

  try {
    const payload = new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const tokenResponse = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    await updateWebUserGoogleCredentials({
      accountId,
      webUserId: pending.web_user_id,
      googleApiKey: tokenResponse.data.access_token,
      googleRefreshToken: tokenResponse.data.refresh_token,
      googleTokenExpiresAt: resolveTokenExpiresAt(tokenResponse.data.expires_in),
      // Google returns the full granted set (include_granted_scopes=true), so replace rather than append.
      googleGrantedScopes: tokenResponse.data.scope ?? undefined,
    });

    const writeScopeGranted = hasGoogleCalendarWriteScope(tokenResponse.data.scope);
    if (!writeScopeGranted) {
      // A (re)connect without the write scope must not leave a stale opt-in flag behind.
      await updateWebUserGoogleCalendarWriteEnabled(accountId, pending.web_user_id, false);
    }

    return {
      ok: true as const,
      requestedAccess: pending.requested_access === 'write' ? ('write' as const) : null,
      writeScopeGranted,
      userId: String(pending.web_user_id),
      connectedAt: new Date().toISOString(),
      tokenMeta: {
        tokenType: tokenResponse.data.token_type,
        scope: tokenResponse.data.scope,
        expiresIn: tokenResponse.data.expires_in,
        hasRefreshToken: Boolean(tokenResponse.data.refresh_token)
      }
    };
  } catch {
    return { ok: false as const, reason: 'token_exchange_failed' };
  }
};

export const refreshGoogleAccessToken = async (input: RefreshGoogleAccessTokenInput) => {
  if (!isGoogleOAuthConfigured()) {
    return null;
  }

  try {
    const payload = new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: input.refreshToken,
      grant_type: 'refresh_token',
    });

    const tokenResponse = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    const googleTokenExpiresAt = resolveTokenExpiresAt(tokenResponse.data.expires_in);
    await updateWebUserGoogleCredentials({
      accountId: input.accountId,
      webUserId: input.webUserId,
      googleApiKey: tokenResponse.data.access_token,
      googleRefreshToken: tokenResponse.data.refresh_token,
      googleTokenExpiresAt,
      googleGrantedScopes: tokenResponse.data.scope ?? undefined,
    });

    return {
      googleApiKey: tokenResponse.data.access_token,
      googleTokenExpiresAt,
    };
  } catch {
    return null;
  }
};

export const disconnectGoogleOAuth = async (userId: string, accountId: number) => {
  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return false;
  }

  await clearWebUserGoogleCredentials(accountId, webUserId);
  return true;
};
