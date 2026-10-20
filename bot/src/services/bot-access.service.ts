import {
  findAccountBotSettingsByAccountId,
  findAccountBotSettingsBySlug,
  findBoundAccountId,
  upsertAccountBinding,
  type AccountBotSettings,
} from '../repositories/bot-access.repository';
import { findOrCreateTelegramUser } from './user.service';

const BOT_SLUG_PATTERN = /^[a-z0-9_-]{3,40}$/;
const START_COMMAND_PATTERN = /^\/start(?:@\w+)?(?:\s+(\S+))?$/;

type TelegramProfile = Parameters<typeof findOrCreateTelegramUser>[1];

export type BotAccess =
  | {
    status: 'ok';
    userResult: Awaited<ReturnType<typeof findOrCreateTelegramUser>>;
    enabled: boolean;
    welcomeMessage: string | null;
  }
  | { status: 'invalid_link' }
  | { status: 'unbound' };

export function parseStartCommand(text: string | undefined): { isStart: boolean; slug: string | null } {
  const match = text ? START_COMMAND_PATTERN.exec(text.trim()) : null;
  return { isStart: Boolean(match), slug: match?.[1] ?? null };
}

async function resolveTarget(
  telegramId: number,
  startSlug: string | null,
): Promise<AccountBotSettings | 'invalid_link' | 'unbound'> {
  if (startSlug !== null) {
    const slug = startSlug.toLowerCase();
    const target = BOT_SLUG_PATTERN.test(slug) ? await findAccountBotSettingsBySlug(slug) : null;
    if (!target) {
      return 'invalid_link';
    }

    await upsertAccountBinding(telegramId, target.accountId);
    return target;
  }

  const boundAccountId = await findBoundAccountId(telegramId);
  if (boundAccountId === null) {
    return 'unbound';
  }

  return (await findAccountBotSettingsByAccountId(boundAccountId)) ?? 'unbound';
}

/**
 * Resolves which account a Telegram user talks to. The shared bot is entered only through
 * `/start <slug>`; afterwards the binding keeps the user in that account.
 */
export async function resolveBotAccess(input: {
  profile: TelegramProfile;
  startSlug: string | null;
}): Promise<BotAccess> {
  const target = await resolveTarget(input.profile.telegramId, input.startSlug);
  if (target === 'invalid_link' || target === 'unbound') {
    return { status: target };
  }

  const userResult = await findOrCreateTelegramUser(target.accountId, input.profile);
  return {
    status: 'ok',
    userResult,
    enabled: target.enabled,
    welcomeMessage: target.welcomeMessage,
  };
}
