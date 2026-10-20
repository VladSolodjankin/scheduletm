import { db } from '../db/knex';

export type AccountBotSettings = {
  accountId: number;
  enabled: boolean;
  welcomeMessage: string | null;
};

type AccountBotSettingsRow = {
  account_id: number;
  telegram_bot_enabled: boolean;
  bot_welcome_message: string | null;
};

function toAccountBotSettings(row: AccountBotSettingsRow | undefined): AccountBotSettings | null {
  if (!row) {
    return null;
  }

  return {
    accountId: row.account_id,
    enabled: row.telegram_bot_enabled,
    welcomeMessage: row.bot_welcome_message,
  };
}

function activeAccountBotSettingsQuery() {
  return db('account_settings as s')
    .join('accounts as a', 'a.id', 's.account_id')
    .where('a.is_active', true)
    .select('s.account_id', 's.telegram_bot_enabled', 's.bot_welcome_message');
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
