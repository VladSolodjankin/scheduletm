import { db } from '../db/knex';
import { decryptIntegrationSecret } from '../utils/integration-secrets';

export type AccountBotSettings = {
  accountId: number;
  enabled: boolean;
  welcomeMessage: string | null;
  /** The account runs its own bot, so the shared bot (and its slug link) must not serve it. */
  hasCustomBot: boolean;
};

type AccountBotSettingsRow = {
  account_id: number;
  telegram_bot_enabled: boolean;
  bot_welcome_message: string | null;
  custom_bot_token_encrypted: string | null;
};

function toAccountBotSettings(row: AccountBotSettingsRow | undefined): AccountBotSettings | null {
  if (!row) {
    return null;
  }

  return {
    accountId: row.account_id,
    enabled: row.telegram_bot_enabled,
    welcomeMessage: row.bot_welcome_message,
    hasCustomBot: Boolean(row.custom_bot_token_encrypted),
  };
}

function activeAccountBotSettingsQuery() {
  return db('account_settings as s')
    .join('accounts as a', 'a.id', 's.account_id')
    .where('a.is_active', true)
    .select('s.account_id', 's.telegram_bot_enabled', 's.bot_welcome_message', 's.custom_bot_token_encrypted');
}

export async function findAccountBotSettingsBySlug(slug: string): Promise<AccountBotSettings | null> {
  const row = await activeAccountBotSettingsQuery()
    .where('s.bot_slug', slug)
    .first<AccountBotSettingsRow>();

  return toAccountBotSettings(row);
}

export async function findAccountBotSettingsByAccountId(accountId: number): Promise<AccountBotSettings | null> {
  const row = await activeAccountBotSettingsQuery()
    .where('s.account_id', accountId)
    .first<AccountBotSettingsRow>();

  return toAccountBotSettings(row);
}

export async function findBoundAccountId(telegramId: number): Promise<number | null> {
  const row = await db('telegram_account_bindings')
    .where({ telegram_id: telegramId })
    .first<{ account_id: number }>('account_id');

  return row?.account_id ?? null;
}

export async function upsertAccountBinding(telegramId: number, accountId: number): Promise<void> {
  await db('telegram_account_bindings')
    .insert({
      telegram_id: telegramId,
      account_id: accountId,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict('telegram_id')
    .merge({ account_id: accountId, updated_at: db.fn.now() });
}

export async function findCustomBotTokenByAccountId(accountId: number): Promise<string | null> {
  const row = await db('account_settings')
    .where({ account_id: accountId })
    .first<{ custom_bot_token_encrypted: string | null }>('custom_bot_token_encrypted');

  return decryptIntegrationSecret(row?.custom_bot_token_encrypted, 'Telegram bot token');
}

export type CustomBotWebhookState = { accountId: number; token: string; registeredHash: string | null };

export async function listCustomBots(): Promise<CustomBotWebhookState[]> {
  const rows = await db('account_settings as s')
    .join('accounts as a', 'a.id', 's.account_id')
    .where('a.is_active', true)
    .whereNotNull('s.custom_bot_token_encrypted')
    .select<{
      account_id: number;
      custom_bot_token_encrypted: string;
      custom_bot_webhook_hash: string | null;
    }[]>('s.account_id', 's.custom_bot_token_encrypted', 's.custom_bot_webhook_hash');

  return rows.flatMap((row) => {
    const token = decryptIntegrationSecret(row.custom_bot_token_encrypted, 'Telegram bot token');
    return token ? [{ accountId: row.account_id, token, registeredHash: row.custom_bot_webhook_hash }] : [];
  });
}

export async function markCustomBotWebhookRegistered(accountId: number, hash: string): Promise<void> {
  await db('account_settings').where({ account_id: accountId }).update({ custom_bot_webhook_hash: hash });
}
