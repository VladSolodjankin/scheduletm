import crypto from 'node:crypto';
import { telegramBotSettingsSchema } from '../config/schemas.js';
import { env } from '../config/env.js';
import { deleteTelegramWebhook, verifyTelegramBotToken } from './telegramService.js';
import {
  findCustomBotTokenByAccountId,
  findTelegramBotSettingsByAccountId,
  isBotSlugConflictError,
  setCustomBot,
  upsertTelegramBotSettings,
} from '../repositories/telegramBotSettingsRepository.js';

export type TelegramBotSettings = {
  enabled: boolean;
  slug: string;
  welcomeMessage: string;
  /** `custom` when the account runs its own bot: no slug is involved and the link is the bot's own. */
  mode: 'shared' | 'custom';
  customBot: { username: string | null; name: string | null } | null;
  botLink: string | null;
};

export class BotSlugTakenError extends Error {
  constructor() {
    super('BOT_SLUG_TAKEN');
  }
}

export class InvalidBotTokenError extends Error {
  constructor() {
    super('INVALID_BOT_TOKEN');
  }
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const GENERATED_SLUG_LENGTH = 10;
const GENERATE_ATTEMPTS = 5;

function generateSlug(): string {
  const bytes = crypto.randomBytes(GENERATED_SLUG_LENGTH);
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join('');
}

let cachedBotUsername: string | null = null;

/** The shared bot's username comes from Telegram itself (getMe) and is cached once resolved. */
async function getBotUsername(): Promise<string | null> {
  if (!cachedBotUsername && env.TELEGRAM_BOT_TOKEN) {
    cachedBotUsername = (await verifyTelegramBotToken(env.TELEGRAM_BOT_TOKEN))?.username ?? null;
  }
  return cachedBotUsername;
}

async function buildBotLink(slug: string): Promise<string | null> {
  const username = await getBotUsername();
  return username ? `https://t.me/${username}?start=${slug}` : null;
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

  const isCustom = Boolean(row?.custom_bot_username);

  return {
    enabled: row?.telegram_bot_enabled ?? true,
    slug,
    welcomeMessage: row?.bot_welcome_message ?? '',
    mode: isCustom ? 'custom' : 'shared',
    customBot: isCustom ? { username: row?.custom_bot_username ?? null, name: row?.custom_bot_name ?? null } : null,
    botLink: isCustom ? `https://t.me/${row?.custom_bot_username}` : await buildBotLink(slug),
  };
}

async function applyCustomBotToken(accountId: number, token: string): Promise<void> {
  if (!token) {
    const previous = await findCustomBotTokenByAccountId(accountId);
    await setCustomBot(accountId, null);
    if (previous) {
      await deleteTelegramWebhook(previous);
    }
    return;
  }

  const info = await verifyTelegramBotToken(token);
  if (!info?.username) {
    throw new InvalidBotTokenError();
  }

  await setCustomBot(accountId, { token, username: info.username, name: info.name });
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

  if (parsed.data.customBotToken !== undefined) {
    await applyCustomBotToken(accountId, parsed.data.customBotToken);
  }

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
