import { db } from '../db/knex.js';
import { decryptIntegrationSecret, encryptIntegrationSecret } from './integrationSecretCrypto.js';

export type WebUserIntegrationRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  google_api_key: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: Date | null;
  google_connected_at: Date | null;
  google_granted_scopes: string | null;
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
  yandex_access_token: string | null;
  yandex_refresh_token: string | null;
  yandex_token_expires_at: Date | null;
  yandex_connected_at: Date | null;
  yandex_last_meeting_id: string | null;
  yandex_last_join_url: string | null;
  microsoft_access_token: string | null;
  microsoft_refresh_token: string | null;
  microsoft_token_expires_at: Date | null;
  microsoft_connected_at: Date | null;
  microsoft_granted_scopes: string | null;
  calendar_feed_token_hash: string | null;
  calendar_feed_created_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type WebUserIntegrationStorageRecord = Omit<
  WebUserIntegrationRecord,
  'google_api_key' | 'google_refresh_token' | 'telegram_bot_token' | 'zoom_access_token' | 'zoom_refresh_token'
  | 'yandex_access_token' | 'yandex_refresh_token' | 'microsoft_access_token' | 'microsoft_refresh_token'
> & {
  google_access_token_encrypted: string | null;
  google_refresh_token_encrypted: string | null;
  telegram_bot_token_encrypted: string | null;
  zoom_access_token_encrypted: string | null;
  zoom_refresh_token_encrypted: string | null;
  yandex_access_token_encrypted: string | null;
  yandex_refresh_token_encrypted: string | null;
  microsoft_access_token_encrypted: string | null;
  microsoft_refresh_token_encrypted: string | null;
};

type UpdateWebUserGoogleCredentialsInput = {
  accountId: number;
  webUserId: number;
  googleApiKey: string;
  googleRefreshToken?: string | null;
  googleTokenExpiresAt?: Date | null;
  googleGrantedScopes?: string | null;
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

type UpdateWebUserYandexIntegrationInput = {
  accountId: number;
  webUserId: number;
  yandexAccessToken?: string | null;
  yandexRefreshToken?: string | null;
  yandexTokenExpiresAt?: Date | null;
  yandexConnectedAt?: Date | null;
  yandexLastMeetingId?: string | null;
  yandexLastJoinUrl?: string | null;
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
    yandex_access_token_encrypted: yandexAccessTokenEncrypted,
    yandex_refresh_token_encrypted: yandexRefreshTokenEncrypted,
    microsoft_access_token_encrypted: microsoftAccessTokenEncrypted,
    microsoft_refresh_token_encrypted: microsoftRefreshTokenEncrypted,
    ...record
  } = row;

  return {
    ...record,
    google_api_key: decryptIntegrationSecret(googleAccessTokenEncrypted, 'Google access token'),
    google_refresh_token: decryptIntegrationSecret(googleRefreshTokenEncrypted, 'Google refresh token'),
    telegram_bot_token: decryptIntegrationSecret(telegramBotTokenEncrypted, 'Telegram bot token'),
    zoom_access_token: decryptIntegrationSecret(zoomAccessTokenEncrypted, 'Zoom access token'),
    zoom_refresh_token: decryptIntegrationSecret(zoomRefreshTokenEncrypted, 'Zoom refresh token'),
    yandex_access_token: decryptIntegrationSecret(yandexAccessTokenEncrypted, 'Yandex access token'),
    yandex_refresh_token: decryptIntegrationSecret(yandexRefreshTokenEncrypted, 'Yandex refresh token'),
    microsoft_access_token: decryptIntegrationSecret(microsoftAccessTokenEncrypted, 'Microsoft access token'),
    microsoft_refresh_token: decryptIntegrationSecret(microsoftRefreshTokenEncrypted, 'Microsoft refresh token'),
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

  if (input.googleGrantedScopes !== undefined) {
    patch.google_granted_scopes = input.googleGrantedScopes;
  }

  await upsertPatch(input.accountId, input.webUserId, patch);
}

export async function clearWebUserGoogleCredentials(accountId: number, webUserId: number): Promise<void> {
  await upsertPatch(accountId, webUserId, {
    google_access_token_encrypted: null,
    google_refresh_token_encrypted: null,
    google_token_expires_at: null,
    google_connected_at: null,
    google_granted_scopes: null,
  });
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

// Update-only on purpose (unlike the upsert-based clears above): disconnecting must never create an empty row.
export async function clearWebUserYandexCredentials(accountId: number, webUserId: number): Promise<void> {
  await db('web_user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .update({
      yandex_access_token_encrypted: null,
      yandex_refresh_token_encrypted: null,
      yandex_token_expires_at: null,
      yandex_connected_at: null,
      yandex_last_meeting_id: null,
      yandex_last_join_url: null,
      updated_at: db.fn.now(),
    });
}

export async function updateWebUserYandexIntegration(input: UpdateWebUserYandexIntegrationInput): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.yandexAccessToken !== undefined) {
    patch.yandex_access_token_encrypted = encryptIntegrationSecret(
      input.yandexAccessToken,
      'Yandex access token',
    );
  }
  if (input.yandexRefreshToken !== undefined) {
    patch.yandex_refresh_token_encrypted = encryptIntegrationSecret(
      input.yandexRefreshToken,
      'Yandex refresh token',
    );
  }
  if (input.yandexTokenExpiresAt !== undefined) {
    patch.yandex_token_expires_at = input.yandexTokenExpiresAt;
  }
  if (input.yandexConnectedAt !== undefined) {
    patch.yandex_connected_at = input.yandexConnectedAt;
  }
  if (input.yandexLastMeetingId !== undefined) {
    patch.yandex_last_meeting_id = input.yandexLastMeetingId;
  }
  if (input.yandexLastJoinUrl !== undefined) {
    patch.yandex_last_join_url = input.yandexLastJoinUrl;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  await upsertPatch(input.accountId, input.webUserId, patch);
}

export type MicrosoftTokenPatch = {
  accessToken: string;
  /** Microsoft rotates refresh tokens: when a response carries one it must replace the stored value. */
  refreshToken?: string | null;
  expiresAt: Date;
  grantedScopes?: string | null;
  connectedAt?: Date;
};

function buildMicrosoftTokenPatch(input: MicrosoftTokenPatch): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    microsoft_access_token_encrypted: encryptIntegrationSecret(input.accessToken, 'Microsoft access token'),
    microsoft_token_expires_at: input.expiresAt,
  };
  if (input.refreshToken !== undefined) {
    patch.microsoft_refresh_token_encrypted = encryptIntegrationSecret(input.refreshToken, 'Microsoft refresh token');
  }
  if (input.grantedScopes !== undefined) {
    patch.microsoft_granted_scopes = input.grantedScopes;
  }
  if (input.connectedAt !== undefined) {
    patch.microsoft_connected_at = input.connectedAt;
  }
  return patch;
}

export async function updateWebUserMicrosoftCredentials(
  input: MicrosoftTokenPatch & { accountId: number; webUserId: number },
): Promise<void> {
  await upsertPatch(input.accountId, input.webUserId, buildMicrosoftTokenPatch(input));
}

// Update-only on purpose (like Yandex): disconnecting must never create an empty row.
export async function clearWebUserMicrosoftCredentials(accountId: number, webUserId: number): Promise<void> {
  await db('web_user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .update({
      microsoft_access_token_encrypted: null,
      microsoft_refresh_token_encrypted: null,
      microsoft_token_expires_at: null,
      microsoft_connected_at: null,
      microsoft_granted_scopes: null,
      updated_at: db.fn.now(),
    });
}

/**
 * Serialises token refreshes per web user: the integration row is locked (SELECT ... FOR UPDATE) while `work`
 * runs, so two workers can never redeem the same rotating refresh token. `work` receives the freshest stored
 * record and a `save` that persists rotated tokens inside the same transaction. The transaction is held for
 * the duration of one bounded (10 s timeout) token request. Returns null when the row does not exist.
 */
export async function withLockedMicrosoftIntegration<T>(
  accountId: number,
  webUserId: number,
  work: (record: WebUserIntegrationRecord, save: (tokens: MicrosoftTokenPatch) => Promise<void>) => Promise<T>,
): Promise<T | null> {
  return db.transaction(async (trx) => {
    const row = await trx('web_user_integrations')
      .where({ account_id: accountId, web_user_id: webUserId })
      .forUpdate()
      .first<WebUserIntegrationStorageRecord>();
    if (!row) {
      return null;
    }

    return work(mapIntegrationRecord(row), async (tokens) => {
      await trx('web_user_integrations')
        .where({ account_id: accountId, web_user_id: webUserId })
        .update({ ...buildMicrosoftTokenPatch(tokens), updated_at: db.fn.now() });
    });
  });
}

/** Stores the SHA-256 hash of a new Apple Calendar feed token (create or rotate). */
export async function setCalendarFeedTokenHash(accountId: number, webUserId: number, tokenHash: string): Promise<Date> {
  const createdAt = new Date();
  await upsertPatch(accountId, webUserId, {
    calendar_feed_token_hash: tokenHash,
    calendar_feed_created_at: createdAt,
  });
  return createdAt;
}

// Update-only: revoking must never create an empty row.
export async function clearCalendarFeedToken(accountId: number, webUserId: number): Promise<void> {
  await db('web_user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .update({
      calendar_feed_token_hash: null,
      calendar_feed_created_at: null,
      updated_at: db.fn.now(),
    });
}

export type CalendarFeedOwner = {
  accountId: number;
  webUserId: number;
  specialistId: number;
  timezone: string;
};

/**
 * Resolves a feed token hash to its specialist. Returns null for unknown/revoked tokens, inactive or deleted
 * users, inactive accounts and web users without a specialist profile, so callers can answer one constant 404.
 */
export async function findCalendarFeedOwnerByTokenHash(tokenHash: string): Promise<CalendarFeedOwner | null> {
  const row = await db('web_user_integrations as wui')
    .join('web_users as wu', function joinWebUsers() {
      this.on('wu.id', '=', 'wui.web_user_id').andOn('wu.account_id', '=', 'wui.account_id');
    })
    .join('accounts as acc', 'acc.id', 'wui.account_id')
    .join('specialists as s', function joinSpecialists() {
      this.on('s.user_id', '=', 'wu.id').andOn('s.account_id', '=', 'wu.account_id');
    })
    .where('wui.calendar_feed_token_hash', tokenHash)
    .where('s.is_active', true)
    .where('wu.is_active', true)
    .where('wu.is_deleted', false)
    .where('acc.is_active', true)
    .first<{ accountId: number; webUserId: number; specialistId: number; timezone: string | null }>(
      'wui.account_id as accountId',
      'wu.id as webUserId',
      's.id as specialistId',
      'wu.timezone as timezone',
    );

  return row ? { ...row, timezone: row.timezone ?? 'UTC' } : null;
}
