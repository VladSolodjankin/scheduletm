import { db } from '../db/knex.js';
import { decryptIntegrationSecret, encryptIntegrationSecret } from './integrationSecretCrypto.js';

export type WebUserIntegrationRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  google_api_key: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: Date | null;
  google_calendar_id: string | null;
  google_connected_at: Date | null;
  telegram_bot_token: string | null;
  telegram_bot_username: string | null;
  telegram_bot_name: string | null;
  zoom_access_token: string | null;
  zoom_refresh_token: string | null;
  zoom_token_expires_at: Date | null;
  zoom_connected_at: Date | null;
  zoom_last_meeting_id: string | null;
  zoom_last_join_url: string | null;
  zoom_last_start_url: string | null;
  created_at: Date;
  updated_at: Date;
};

type WebUserIntegrationStorageRecord = Omit<
  WebUserIntegrationRecord,
  'google_api_key' | 'google_refresh_token' | 'telegram_bot_token' | 'zoom_access_token' | 'zoom_refresh_token'
> & {
  google_access_token_encrypted: string | null;
  google_refresh_token_encrypted: string | null;
  telegram_bot_token_encrypted: string | null;
  zoom_access_token_encrypted: string | null;
  zoom_refresh_token_encrypted: string | null;
};

type UpdateWebUserGoogleCredentialsInput = {
  accountId: number;
  webUserId: number;
  googleApiKey: string;
  googleRefreshToken?: string | null;
  googleTokenExpiresAt?: Date | null;
  googleCalendarId?: string | null;
};

type UpdateWebUserTelegramIntegrationInput = {
  accountId: number;
  webUserId: number;
  telegramBotToken?: string | null;
  telegramBotUsername?: string | null;
  telegramBotName?: string | null;
};

type UpdateWebUserZoomIntegrationInput = {
  accountId: number;
  webUserId: number;
  zoomAccessToken?: string | null;
  zoomRefreshToken?: string | null;
  zoomTokenExpiresAt?: Date | null;
  zoomConnectedAt?: Date | null;
  zoomLastMeetingId?: string | null;
  zoomLastJoinUrl?: string | null;
  zoomLastStartUrl?: string | null;
};

async function upsertPatch(
  accountId: number,
  webUserId: number,
  patch: Record<string, unknown>,
): Promise<void> {
  await db('web_user_integrations')
    .insert({
      account_id: accountId,
      web_user_id: webUserId,
      ...patch,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id', 'web_user_id'])
    .merge({
      ...patch,
      updated_at: db.fn.now(),
    });
}

function mapIntegrationRecord(row: WebUserIntegrationStorageRecord): WebUserIntegrationRecord {
  const {
    google_access_token_encrypted: googleAccessTokenEncrypted,
    google_refresh_token_encrypted: googleRefreshTokenEncrypted,
    telegram_bot_token_encrypted: telegramBotTokenEncrypted,
    zoom_access_token_encrypted: zoomAccessTokenEncrypted,
    zoom_refresh_token_encrypted: zoomRefreshTokenEncrypted,
    ...record
  } = row;

  return {
    ...record,
    google_api_key: decryptIntegrationSecret(googleAccessTokenEncrypted, null, 'Google access token'),
    google_refresh_token: decryptIntegrationSecret(googleRefreshTokenEncrypted, null, 'Google refresh token'),
    telegram_bot_token: decryptIntegrationSecret(telegramBotTokenEncrypted, null, 'Telegram bot token'),
    zoom_access_token: decryptIntegrationSecret(zoomAccessTokenEncrypted, null, 'Zoom access token'),
    zoom_refresh_token: decryptIntegrationSecret(zoomRefreshTokenEncrypted, null, 'Zoom refresh token'),
  };
}

export async function findWebUserIntegrationByWebUserId(
  accountId: number,
  webUserId: number,
): Promise<WebUserIntegrationRecord | null> {
  const row = await db('web_user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .first<WebUserIntegrationStorageRecord>();

  return row ? mapIntegrationRecord(row) : null;
}

export async function findTelegramIntegrationByAccountId(accountId: number): Promise<WebUserIntegrationRecord | null> {
  const row = await db('web_user_integrations')
    .where({ account_id: accountId })
    .whereNotNull('telegram_bot_token_encrypted')
    .orderBy('updated_at', 'desc')
    .first<WebUserIntegrationStorageRecord>();

  return row ? mapIntegrationRecord(row) : null;
}

export async function updateWebUserGoogleCredentials(input: UpdateWebUserGoogleCredentialsInput): Promise<void> {
  const patch: Record<string, unknown> = {
    google_access_token_encrypted: encryptIntegrationSecret(input.googleApiKey, 'Google access token'),
    google_connected_at: db.fn.now(),
  };

  if (input.googleRefreshToken !== undefined) {
    patch.google_refresh_token_encrypted = encryptIntegrationSecret(
      input.googleRefreshToken,
      'Google refresh token',
    );
  }

  if (input.googleTokenExpiresAt !== undefined) {
    patch.google_token_expires_at = input.googleTokenExpiresAt;
  }

  if (input.googleCalendarId !== undefined) {
    patch.google_calendar_id = input.googleCalendarId;
  }

  await upsertPatch(input.accountId, input.webUserId, patch);
}

export async function clearWebUserGoogleCredentials(accountId: number, webUserId: number): Promise<void> {
  await upsertPatch(accountId, webUserId, {
    google_access_token_encrypted: null,
    google_refresh_token_encrypted: null,
    google_token_expires_at: null,
    google_calendar_id: null,
    google_connected_at: null,
  });
}

export async function updateWebUserTelegramIntegration(input: UpdateWebUserTelegramIntegrationInput): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.telegramBotToken !== undefined) {
    patch.telegram_bot_token_encrypted = encryptIntegrationSecret(
      input.telegramBotToken,
      'Telegram bot token',
    );
  }

  if (input.telegramBotUsername !== undefined) {
    patch.telegram_bot_username = input.telegramBotUsername;
  }

  if (input.telegramBotName !== undefined) {
    patch.telegram_bot_name = input.telegramBotName;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  await upsertPatch(input.accountId, input.webUserId, patch);
}


export async function clearWebUserZoomCredentials(accountId: number, webUserId: number): Promise<void> {
  await upsertPatch(accountId, webUserId, {
    zoom_access_token_encrypted: null,
    zoom_refresh_token_encrypted: null,
    zoom_token_expires_at: null,
    zoom_connected_at: null,
    zoom_last_meeting_id: null,
    zoom_last_join_url: null,
    zoom_last_start_url: null,
  });
}
export async function updateWebUserZoomIntegration(input: UpdateWebUserZoomIntegrationInput): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.zoomAccessToken !== undefined) {
    patch.zoom_access_token_encrypted = encryptIntegrationSecret(
      input.zoomAccessToken,
      'Zoom access token',
    );
  }
  if (input.zoomRefreshToken !== undefined) {
    patch.zoom_refresh_token_encrypted = encryptIntegrationSecret(
      input.zoomRefreshToken,
      'Zoom refresh token',
    );
  }
  if (input.zoomTokenExpiresAt !== undefined) {
    patch.zoom_token_expires_at = input.zoomTokenExpiresAt;
  }
  if (input.zoomConnectedAt !== undefined) {
    patch.zoom_connected_at = input.zoomConnectedAt;
  }
  if (input.zoomLastMeetingId !== undefined) {
    patch.zoom_last_meeting_id = input.zoomLastMeetingId;
  }
  if (input.zoomLastJoinUrl !== undefined) {
    patch.zoom_last_join_url = input.zoomLastJoinUrl;
  }
  if (input.zoomLastStartUrl !== undefined) {
    patch.zoom_last_start_url = input.zoomLastStartUrl;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  await upsertPatch(input.accountId, input.webUserId, patch);
}
