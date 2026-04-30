import axios from 'axios';
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
  expires_in: number;
};

type ZoomMeetingResponse = {
  id: number;
  join_url: string;
  start_url: string;
};

const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_URL = 'https://api.zoom.us/v2/users/me/meetings';

const isZoomConfigured = () => Boolean(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET);

async function fetchZoomAccessToken() {
  const auth = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post<ZoomTokenResponse>(
    `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(env.ZOOM_ACCOUNT_ID)}`,
    null,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      timeout: 10000,
    },
  );

  return {
    accessToken: response.data.access_token,
    expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
  };
}

export async function createZoomMeeting(input: CreateZoomMeetingInput) {
  if (!isZoomConfigured()) {
    return { ok: false as const, reason: 'zoom_not_configured' };
  }

  const webUserId = Number(input.userId);
  if (!Number.isInteger(webUserId)) {
    return { ok: false as const, reason: 'invalid_user' };
  }

  const accountId = await getDefaultAccountId();
  const existing = await findWebUserIntegrationByWebUserId(accountId, webUserId);
  const isCachedTokenValid =
    Boolean(existing?.zoom_access_token) &&
    Boolean(existing?.zoom_token_expires_at) &&
    new Date(existing!.zoom_token_expires_at!).getTime() > Date.now() + 30_000;

  const tokenData = isCachedTokenValid
    ? {
      accessToken: existing!.zoom_access_token as string,
      expiresAt: existing!.zoom_token_expires_at as Date,
    }
    : await fetchZoomAccessToken();

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
