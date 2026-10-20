import { db } from '../db/knex.js';

export type TelegramBotSettingsRecord = {
  bot_slug: string | null;
  telegram_bot_enabled: boolean;
  bot_welcome_message: string | null;
};

export type UpdateTelegramBotSettingsInput = {
  accountId: number;
  botSlug?: string;
  enabled?: boolean;
  welcomeMessage?: string | null;
};

const SLUG_UNIQUE_CONSTRAINT = 'account_settings_bot_slug_unique';

export async function findTelegramBotSettingsByAccountId(
  accountId: number,
): Promise<TelegramBotSettingsRecord | null> {
  const row = await db('account_settings')
    .where({ account_id: accountId })
    .first<TelegramBotSettingsRecord>('bot_slug', 'telegram_bot_enabled', 'bot_welcome_message');

  return row ?? null;
}

export function isBotSlugConflictError(error: unknown): boolean {
  const candidate = error as { code?: string; constraint?: string } | null;
  return candidate?.code === '23505' && candidate.constraint === SLUG_UNIQUE_CONSTRAINT;
}

/**
 * Creates the account_settings row when it does not exist yet (legacy accounts only have
 * app_settings), without touching unrelated columns of an existing row.
 */
export async function upsertTelegramBotSettings(input: UpdateTelegramBotSettingsInput): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: db.fn.now() };

  if (input.botSlug !== undefined) {
    patch.bot_slug = input.botSlug;
  }
  if (input.enabled !== undefined) {
    patch.telegram_bot_enabled = input.enabled;
  }
  if (input.welcomeMessage !== undefined) {
    patch.bot_welcome_message = input.welcomeMessage;
  }

  await db('account_settings')
    .insert({
      account_id: input.accountId,
      bot_slug: input.botSlug ?? null,
      telegram_bot_enabled: input.enabled ?? true,
      bot_welcome_message: input.welcomeMessage ?? null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id'])
    .merge(patch);
}
