import axios, { isAxiosError } from 'axios';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { findWebUserIntegrationByWebUserId, updateWebUserYandexIntegration } from '../repositories/webUserIntegrationRepository.js';

type CreateYandexTelemostMeetingInput = {
  accountId: number;
  userId: string;
};

type YandexTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type YandexConferenceResponse = {
  id: string;
  join_url: string;
};

const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_TELEMOST_API_URL = 'https://cloud-api.yandex.net/v1/telemost-api/conferences';
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

const isYandexOAuthConfigured = () => Boolean(env.YANDEX_OAUTH_CLIENT_ID && env.YANDEX_OAUTH_CLIENT_SECRET);

async function refreshYandexAccessToken(refreshToken: string) {
  const payload = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.YANDEX_OAUTH_CLIENT_ID,
    client_secret: env.YANDEX_OAUTH_CLIENT_SECRET,
  });

  const response = await axios.post<YandexTokenResponse>(YANDEX_TOKEN_URL, payload.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  return {
    accessToken: response.data.access_token,
    // Yandex may or may not rotate the refresh token; keep the previous one when it is omitted.
    refreshToken: response.data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + (response.data.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS) * 1000),
  };
}

export async function createYandexTelemostMeeting(input: CreateYandexTelemostMeetingInput) {
  if (!isYandexOAuthConfigured()) {
    return { ok: false as const, reason: 'yandex_not_configured' };
  }

  const webUserId = Number(input.userId);
  if (!Number.isInteger(webUserId)) {
    return { ok: false as const, reason: 'invalid_user' };
  }

  const accountId = input.accountId;
  const existing = await findWebUserIntegrationByWebUserId(accountId, webUserId);
  if (!existing?.yandex_access_token) {
    return { ok: false as const, reason: 'yandex_not_connected' };
  }

  let tokenData = {
    accessToken: existing.yandex_access_token,
    refreshToken: existing.yandex_refresh_token,
    expiresAt: existing.yandex_token_expires_at,
  };

  const refresh = async () => {
    if (!tokenData.refreshToken) {
      return false;
    }
    try {
      tokenData = await refreshYandexAccessToken(tokenData.refreshToken);
      await updateWebUserYandexIntegration({
        accountId,
        webUserId,
        yandexAccessToken: tokenData.accessToken,
        yandexRefreshToken: tokenData.refreshToken,
        yandexTokenExpiresAt: tokenData.expiresAt,
      });
      return true;
    } catch {
      return false;
    }
  };

  const isExpired = !tokenData.expiresAt || tokenData.expiresAt.getTime() <= Date.now() + 30_000;
  if (isExpired) {
    if (!tokenData.refreshToken) {
      return { ok: false as const, reason: 'yandex_not_connected' };
    }
    if (!(await refresh())) {
      return { ok: false as const, reason: 'yandex_auth_failed' };
    }
  }

  const createConference = () => axios.post<YandexConferenceResponse>(
    YANDEX_TELEMOST_API_URL,
    { waiting_room_level: 'PUBLIC' },
    {
      headers: {
        Authorization: `OAuth ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    },
  );

  try {
    let response;
    try {
      response = await createConference();
    } catch (error) {
      // The token can be revoked/invalidated before its recorded expiry: refresh once and retry.
      if (!isAxiosError(error) || error.response?.status !== 401) {
        throw error;
      }
      if (!(await refresh())) {
        return { ok: false as const, reason: 'yandex_auth_failed' };
      }
      response = await createConference();
    }

    await updateWebUserYandexIntegration({
      accountId,
      webUserId,
      yandexConnectedAt: new Date(),
      yandexLastMeetingId: String(response.data.id),
      yandexLastJoinUrl: response.data.join_url,
    });

    return {
      ok: true as const,
      meeting: {
        yandexMeetingId: String(response.data.id),
        joinUrl: response.data.join_url,
      },
    };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return { ok: false as const, reason: 'yandex_auth_failed' };
    }
    return { ok: false as const, reason: 'yandex_create_failed' };
  }
}
