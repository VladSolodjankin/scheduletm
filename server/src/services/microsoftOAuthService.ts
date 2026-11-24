import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { createMicrosoftOAuthState, consumeMicrosoftOAuthState } from '../repositories/microsoftOAuthStateRepository.js';
import {
  clearWebUserMicrosoftCredentials,
  updateWebUserMicrosoftCredentials,
  withLockedMicrosoftIntegration,
} from '../repositories/webUserIntegrationRepository.js';
import { hasMicrosoftCalendarWriteScope, MICROSOFT_OAUTH_SCOPES } from '../utils/microsoftScopes.js';

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

// "common" accepts work/school and personal Microsoft accounts.
const MICROSOFT_AUTH_BASE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const DEFAULT_TOKEN_TTL_SECONDS = 3600;
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;
const ACCESS_TOKEN_SAFETY_WINDOW_MS = 30_000;

const hasValidRedirectUri = () => {
  try {
    const redirectUrl = new URL(env.MICROSOFT_OAUTH_REDIRECT_URI);
    const apiBaseUrl = new URL(env.API_BASE_URL);

    const isExpectedPath = redirectUrl.pathname === '/api/integrations/microsoft/oauth/callback';
    const isSameOriginAsApi = redirectUrl.origin === apiBaseUrl.origin;
    const isAllowedProtocol = env.PORT === 3003
      ? redirectUrl.protocol === 'http:' || redirectUrl.protocol === 'https:'
      : redirectUrl.protocol === 'https:';

    return isExpectedPath && isSameOriginAsApi && isAllowedProtocol;
  } catch {
    return false;
  }
};

export const isMicrosoftOAuthConfigured = () => Boolean(
  env.MICROSOFT_OAUTH_CLIENT_ID
  && env.MICROSOFT_OAUTH_CLIENT_SECRET
  && env.MICROSOFT_OAUTH_REDIRECT_URI
  && hasValidRedirectUri(),
);

const resolveExpiresAt = (expiresIn: number | undefined) =>
  new Date(Date.now() + (expiresIn ?? DEFAULT_TOKEN_TTL_SECONDS) * 1000);

const isAccessTokenExpired = (expiresAt: Date | null) =>
  !expiresAt || expiresAt.getTime() <= Date.now() + ACCESS_TOKEN_SAFETY_WINDOW_MS;

export const createMicrosoftOAuthUrl = async (userId: string, accountId: number) => {
  if (!isMicrosoftOAuthConfigured()) {
    return null;
  }

  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return null;
  }

  const state = randomBytes(32).toString('hex');

  await createMicrosoftOAuthState({
    accountId,
    webUserId,
    stateToken: state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const params = new URLSearchParams({
    client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MICROSOFT_OAUTH_REDIRECT_URI,
    response_mode: 'query',
    scope: MICROSOFT_OAUTH_SCOPES,
    state,
    // Lets the specialist pick the account that owns the calendar instead of silently reusing a browser session.
    prompt: 'select_account',
  });

  return {
    url: `${MICROSOFT_AUTH_BASE_URL}?${params.toString()}`,
    state,
  };
};

export type MicrosoftOAuthFailureReason =
  | 'microsoft_oauth_not_configured'
  | 'invalid_state'
  | 'calendar_write_required'
  | 'token_exchange_failed'
  | 'access_denied'
  | 'admin_consent_required'
  | 'provider_error';

export const completeMicrosoftOAuth = async (state: string, code: string) => {
  if (!isMicrosoftOAuthConfigured()) {
    return { ok: false as const, reason: 'microsoft_oauth_not_configured' as MicrosoftOAuthFailureReason };
  }

  const pending = await consumeMicrosoftOAuthState(state);
  if (!pending) {
    return { ok: false as const, reason: 'invalid_state' as MicrosoftOAuthFailureReason };
  }

  try {
    const payload = new URLSearchParams({
      client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
      client_secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: env.MICROSOFT_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: MICROSOFT_OAUTH_SCOPES,
    });

    const tokenResponse = await axios.post<MicrosoftTokenResponse>(MICROSOFT_TOKEN_URL, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: TOKEN_REQUEST_TIMEOUT_MS,
    });

    if (!hasMicrosoftCalendarWriteScope(tokenResponse.data.scope)) {
      // Calendar write was not granted: the connection is failed and nothing stays stored.
      await clearWebUserMicrosoftCredentials(pending.account_id, pending.web_user_id);
      return { ok: false as const, reason: 'calendar_write_required' as MicrosoftOAuthFailureReason };
    }
    if (!tokenResponse.data.refresh_token) {
      // Without offline_access the background sync could not outlive the one-hour access token.
      await clearWebUserMicrosoftCredentials(pending.account_id, pending.web_user_id);
      return { ok: false as const, reason: 'token_exchange_failed' as MicrosoftOAuthFailureReason };
    }

    await updateWebUserMicrosoftCredentials({
      accountId: pending.account_id,
      webUserId: pending.web_user_id,
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      expiresAt: resolveExpiresAt(tokenResponse.data.expires_in),
      grantedScopes: tokenResponse.data.scope ?? null,
      connectedAt: new Date(),
    });

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'token_exchange_failed' as MicrosoftOAuthFailureReason };
  }
};

/**
 * Maps an authorize-endpoint error redirect (?error=...&error_description=...) to a stable reason.
 * The state is consumed so it cannot be replayed. Nothing from the provider is echoed to the caller.
 */
export const failMicrosoftOAuth = async (
  state: string,
  error: string,
  description: string,
): Promise<MicrosoftOAuthFailureReason> => {
  if (state) {
    try {
      await consumeMicrosoftOAuthState(state);
    } catch {
      // The state expires on its own; the redirect below is what matters.
    }
  }

  // AADSTS65001 / AADSTS90094 / AADSTS90095: consent/admin approval requires an administrator to approve the app.
  if (/AADSTS(?:65001|90094|90095)/i.test(description) || error === 'consent_required' || error === 'interaction_required') {
    return 'admin_consent_required';
  }
  if (error === 'access_denied') {
    return 'access_denied';
  }
  return 'provider_error';
};

export type UsableMicrosoftAccessToken =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'no_refresh_token' | 'refresh_failed' | 'invalid_grant' };

function isInvalidGrant(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const body = error.response?.data as { error?: unknown } | undefined;
  return body?.error === 'invalid_grant';
}

/**
 * Refreshes the access token under a per-web-user row lock. Microsoft rotates the refresh token on every
 * redemption, so the lock guarantees one redemption at a time and the rotated token is persisted in the same
 * transaction. If another worker already refreshed while we waited (stored token differs from the rejected one
 * and is still valid) the stored token is reused without a token request. Tokens are never logged.
 */
export const refreshMicrosoftAccessToken = async (input: {
  accountId: number;
  webUserId: number;
  /** The access token that was just rejected (401), if any. */
  rejectedAccessToken?: string | null;
}): Promise<UsableMicrosoftAccessToken> => {
  if (!isMicrosoftOAuthConfigured()) {
    return { ok: false, reason: 'refresh_failed' };
  }

  try {
    const result = await withLockedMicrosoftIntegration<UsableMicrosoftAccessToken>(
      input.accountId,
      input.webUserId,
      async (record, save) => {
        const stored = record.microsoft_access_token;
        if (
          stored
          && !isAccessTokenExpired(record.microsoft_token_expires_at)
          && stored !== (input.rejectedAccessToken ?? null)
        ) {
          return { ok: true, accessToken: stored };
        }
        if (!record.microsoft_refresh_token) {
          return { ok: false, reason: 'no_refresh_token' };
        }

        let data: MicrosoftTokenResponse;
        try {
          const payload = new URLSearchParams({
            client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
            client_secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
            refresh_token: record.microsoft_refresh_token,
            grant_type: 'refresh_token',
            scope: MICROSOFT_OAUTH_SCOPES,
          });
          const response = await axios.post<MicrosoftTokenResponse>(MICROSOFT_TOKEN_URL, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: TOKEN_REQUEST_TIMEOUT_MS,
          });
          data = response.data;
        } catch (error) {
          return { ok: false, reason: isInvalidGrant(error) ? 'invalid_grant' : 'refresh_failed' };
        }

        await save({
          accessToken: data.access_token,
          // Persist the rotated refresh token on EVERY refresh; keep the old one only if none was returned.
          refreshToken: data.refresh_token ?? undefined,
          expiresAt: resolveExpiresAt(data.expires_in),
          grantedScopes: data.scope ?? undefined,
        });
        return { ok: true, accessToken: data.access_token };
      },
    );

    return result ?? { ok: false, reason: 'no_refresh_token' };
  } catch {
    return { ok: false, reason: 'refresh_failed' };
  }
};

/** Returns a non-expired access token for the web user, refreshing (and persisting) it when needed. */
export async function resolveUsableMicrosoftAccessToken(input: {
  accountId: number;
  webUserId: number;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  /** Set after a 401 from Graph. */
  forceRefresh?: boolean;
}): Promise<UsableMicrosoftAccessToken> {
  if (input.accessToken && !input.forceRefresh && !isAccessTokenExpired(input.expiresAt)) {
    return { ok: true, accessToken: input.accessToken };
  }
  if (!input.refreshToken) {
    return { ok: false, reason: 'no_refresh_token' };
  }

  return refreshMicrosoftAccessToken({
    accountId: input.accountId,
    webUserId: input.webUserId,
    rejectedAccessToken: input.forceRefresh ? input.accessToken : null,
  });
}

export const disconnectMicrosoftOAuth = async (userId: string, accountId: number) => {
  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return false;
  }

  await clearWebUserMicrosoftCredentials(accountId, webUserId);
  return true;
};
