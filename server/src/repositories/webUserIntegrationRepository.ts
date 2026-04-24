import { db } from '../db/knex.js';

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
  created_at: Date;
  updated_at: Date;
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

export async function findWebUserIntegrationByWebUserId(
  accountId: number,
  webUserId: number,
): Promise<WebUserIntegrationRecord | null> {
  const row = await db('web_user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .first<WebUserIntegrationRecord>();

  return row ?? null;
}

export async function updateWebUserGoogleCredentials(input: UpdateWebUserGoogleCredentialsInput): Promise<void> {
  const patch: Record<string, unknown> = {
    google_api_key: input.googleApiKey,
    google_connected_at: db.fn.now(),
  };

  if (input.googleRefreshToken !== undefined) {
    patch.google_refresh_token = input.googleRefreshToken;
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
    google_api_key: null,
    google_refresh_token: null,
    google_token_expires_at: null,
    google_calendar_id: null,
    google_connected_at: null,
  });
}

export async function updateWebUserTelegramIntegration(input: UpdateWebUserTelegramIntegrationInput): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.telegramBotToken !== undefined) {
    patch.telegram_bot_token = input.telegramBotToken;
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
