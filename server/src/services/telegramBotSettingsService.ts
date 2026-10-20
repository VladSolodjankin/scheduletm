import crypto from 'node:crypto';
import { telegramBotSettingsSchema } from '../config/schemas.js';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { findSharedTelegramBotUsername } from '../repositories/webUserIntegrationRepository.js';
import {
  findTelegramBotSettingsByAccountId,
  isBotSlugConflictError,
  upsertTelegramBotSettings,
} from '../repositories/telegramBotSettingsRepository.js';

export type TelegramBotSettings = {
  enabled: boolean;
  slug: string;
  welcomeMessage: string;
  botLink: string | null;
};

export class BotSlugTakenError extends Error {
  constructor() {
    super('BOT_SLUG_TAKEN');
  }
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const GENERATED_SLUG_LENGTH = 10;
const GENERATE_ATTEMPTS = 5;

function generateSlug(): string {
  const bytes = crypto.randomBytes(GENERATED_SLUG_LENGTH);
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join('');
}

async function buildBotLink(slug: string): Promise<string | null> {
  const username = await findSharedTelegramBotUsername(await getDefaultAccountId());
  return username ? `https://t.me/${username.replace(/^@/, '')}?start=${slug}` : null;
}

/** The slug is created lazily on first read so account creation flows stay untouched. */
async function ensureSlug(accountId: number): Promise<string> {
  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt += 1) {
    const current = await findTelegramBotSettingsByAccountId(accountId);
    if (current?.bot_slug) {
      return current.bot_slug;
    }

    try {
      await upsertTelegramBotSettings({ accountId, botSlug: generateSlug() });
    } catch (error) {
      if (!isBotSlugConflictError(error)) {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate a Telegram bot slug');
}

async function mapSettings(accountId: number): Promise<TelegramBotSettings> {
  const slug = await ensureSlug(accountId);
  const row = await findTelegramBotSettingsByAccountId(accountId);

  return {
    enabled: row?.telegram_bot_enabled ?? true,
    slug,
    welcomeMessage: row?.bot_welcome_message ?? '',
    botLink: await buildBotLink(slug),
  };
}

export async function getTelegramBotSettings(accountId: number): Promise<TelegramBotSettings> {
  return mapSettings(accountId);
}

export async function updateTelegramBotSettings(
  accountId: number,
  payload: unknown,
): Promise<TelegramBotSettings | null> {
  const parsed = telegramBotSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  await ensureSlug(accountId);

  try {
    await upsertTelegramBotSettings({
      accountId,
      botSlug: parsed.data.slug,
      enabled: parsed.data.enabled,
      welcomeMessage: parsed.data.welcomeMessage === undefined
        ? undefined
        : (parsed.data.welcomeMessage.trim() || null),
    });
  } catch (error) {
    if (isBotSlugConflictError(error)) {
      throw new BotSlugTakenError();
    }
    throw error;
  }

  return mapSettings(accountId);
}
