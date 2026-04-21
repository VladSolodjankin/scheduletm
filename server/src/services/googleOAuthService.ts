import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { createGoogleOAuthState, consumeGoogleOAuthState } from '../repositories/googleOAuthStateRepository.js';
import { updateWebUserGoogleCredentials } from '../repositories/webUserRepository.js';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DEFAULT_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.readonly'
];

const isGoogleOAuthConfigured = () => {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID &&
      env.GOOGLE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REDIRECT_URI
  );
};

export const createGoogleOAuthUrl = async (userId: string) => {
  if (!isGoogleOAuthConfigured()) {
    return null;
  }

  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return null;
  }

  const accountId = await getDefaultAccountId();
  const state = randomBytes(32).toString('hex');

  await createGoogleOAuthState({
    accountId,
    webUserId,
    stateToken: state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    scope: env.GOOGLE_OAUTH_SCOPES || GOOGLE_DEFAULT_SCOPES.join(' '),
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

  const accountId = await getDefaultAccountId();
  const pending = await consumeGoogleOAuthState(accountId, state);
  if (!pending) {
    return { ok: false as const, reason: 'invalid_state' };
  }

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
      id: pending.web_user_id,
      googleApiKey: tokenResponse.data.access_token
    });

    return {
      ok: true as const,
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
