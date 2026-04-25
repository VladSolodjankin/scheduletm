import { db } from '../db/knex.js';

export type UserIntegrationRecord = {
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
};

type UpdateUserTelegramIntegrationInput = {
  accountId: number;
  webUserId: number;
  telegramBotToken?: string | null;
  telegramBotUsername?: string | null;
  telegramBotName?: string | null;
};

async function upsertPatch(accountId: number, webUserId: number, patch: Record<string, unknown>): Promise<void> {
  await db('user_integrations')
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

export async function findUserIntegrationByWebUserId(
  accountId: number,
  webUserId: number,
): Promise<UserIntegrationRecord | null> {
  const row = await db('user_integrations')
    .where({ account_id: accountId, web_user_id: webUserId })
    .first<UserIntegrationRecord>();

  return row ?? null;
}

export async function updateUserTelegramIntegration(input: UpdateUserTelegramIntegrationInput): Promise<void> {
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
