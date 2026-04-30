import axios from 'axios';
import { URLSearchParams } from 'node:url';
import { env } from '../config/env.js';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { findWebUserIntegrationByWebUserId, updateWebUserZoomIntegration } from '../repositories/webUserIntegrationRepository.js';

type CreateZoomMeetingInput = {
  userId: string;
  topic: string;
  startTime: string;
  duration: number;
  timezone: string;
};

type ZoomTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type ZoomMeetingResponse = {
  id: number;
  join_url: string;
  start_url: string;
};

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_URL = 'https://api.zoom.us/v2/users/me/meetings';

const isZoomOAuthConfigured = () => Boolean(env.ZOOM_OAUTH_CLIENT_ID && env.ZOOM_OAUTH_CLIENT_SECRET);

async function refreshZoomAccessToken(refreshToken: string) {
  const payload = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.ZOOM_OAUTH_CLIENT_ID,
    client_secret: env.ZOOM_OAUTH_CLIENT_SECRET,
  });

  const response = await axios.post<ZoomTokenResponse>(ZOOM_TOKEN_URL, payload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
  };
}

export async function createZoomMeeting(input: CreateZoomMeetingInput) {
  if (!isZoomOAuthConfigured()) {
    return { ok: false as const, reason: 'zoom_not_configured' };
  }

  const webUserId = Number(input.userId);
  if (!Number.isInteger(webUserId)) {
    return { ok: false as const, reason: 'invalid_user' };
  }

  const accountId = await getDefaultAccountId();
  const existing = await findWebUserIntegrationByWebUserId(accountId, webUserId);
  if (!existing?.zoom_access_token) {
    return { ok: false as const, reason: 'zoom_not_connected' };
  }

  let tokenData = {
    accessToken: existing.zoom_access_token,
    refreshToken: existing.zoom_refresh_token,
    expiresAt: existing.zoom_token_expires_at,
  };

  const isExpired = !tokenData.expiresAt || tokenData.expiresAt.getTime() <= Date.now() + 30_000;
  if (isExpired) {
    if (!tokenData.refreshToken) {
      return { ok: false as const, reason: 'zoom_not_connected' };
    }

    try {
      tokenData = await refreshZoomAccessToken(tokenData.refreshToken);
      await updateWebUserZoomIntegration({
        accountId,
        webUserId,
        zoomAccessToken: tokenData.accessToken,
        zoomRefreshToken: tokenData.refreshToken,
        zoomTokenExpiresAt: tokenData.expiresAt,
      });
    } catch {
      return { ok: false as const, reason: 'zoom_auth_failed' };
    }
  }

  try {
    const response = await axios.post<ZoomMeetingResponse>(
      ZOOM_API_URL,
      {
        topic: input.topic,
        type: 2,
        start_time: input.startTime,
        duration: input.duration,
        timezone: input.timezone,
        settings: {
          waiting_room: true,
          join_before_host: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    await updateWebUserZoomIntegration({
      accountId,
      webUserId,
      zoomAccessToken: tokenData.accessToken,
      zoomRefreshToken: tokenData.refreshToken,
      zoomTokenExpiresAt: tokenData.expiresAt,
      zoomConnectedAt: new Date(),
      zoomLastMeetingId: String(response.data.id),
      zoomLastJoinUrl: response.data.join_url,
      zoomLastStartUrl: response.data.start_url,
    });

    return {
      ok: true as const,
      meeting: {
        zoomMeetingId: String(response.data.id),
        joinUrl: response.data.join_url,
        startUrl: response.data.start_url,
      },
    };
  } catch {
    return { ok: false as const, reason: 'zoom_create_failed' };
  }
}
