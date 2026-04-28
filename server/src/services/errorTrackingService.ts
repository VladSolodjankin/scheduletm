import { canManageSystemSettings } from '../policies/rolePermissions.js';
import { insertErrorLog, listErrorLogs, purgeExpiredErrorLogs, type ErrorLogRecord } from '../repositories/errorLogRepository.js';
import { getSystemSettingsRecord } from '../repositories/systemSettingsRepository.js';
import { env } from '../config/env.js';
import { decryptText } from '../utils/crypto.js';
import { sendTelegramBotMessage } from './telegramService.js';
import type { User } from '../types/domain.js';

const ERROR_MESSAGE_MAX = 2000;
const ERROR_STACK_MAX = 6000;

export type ErrorLogDto = {
  id: number;
  accountId: number | null;
  webUserId: number | null;
  source: 'web' | 'server';
  level: string;
  method: string | null;
  path: string | null;
  message: string;
  stack: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

function normalizeText(value: unknown, max = ERROR_MESSAGE_MAX): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, max);
}

function mapErrorLog(item: ErrorLogRecord): ErrorLogDto {
  return {
    id: item.id,
    accountId: item.account_id,
    webUserId: item.web_user_id,
    source: item.source,
    level: item.level,
    method: item.method,
    path: item.path,
    message: item.message,
    stack: item.stack,
    metadata: item.metadata_json,
    createdAt: item.created_at.toISOString(),
  };
}

async function cleanupExpiredLogs(): Promise<void> {
  await purgeExpiredErrorLogs(7);
}

function normalizeInline(value: string | null | undefined, max = 120): string {
  if (!value) {
    return '-';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

async function notifyErrorToTelegram(input: {
  source: 'web' | 'server';
  message: string;
  method?: string | null;
  path?: string | null;
  accountId?: number | null;
  webUserId?: number | null;
}): Promise<void> {
  const encryptionKey = env.APP_ENCRYPTION_KEY.trim();
  if (!encryptionKey) {
    return;
  }

  const systemSettings = await getSystemSettingsRecord();
  const botToken = systemSettings?.error_alerts_telegram_bot_token_encrypted
    ? (decryptText(systemSettings.error_alerts_telegram_bot_token_encrypted, encryptionKey) ?? '').trim()
    : '';
  const chatId = systemSettings?.error_alerts_telegram_chat_id_encrypted
    ? (decryptText(systemSettings.error_alerts_telegram_chat_id_encrypted, encryptionKey) ?? '').trim()
    : '';

  if (!botToken || !chatId) {
    return;
  }

  const lines = [
    '🚨 Error log',
    `source: ${input.source}`,
    `message: ${normalizeInline(input.message, 300)}`,
    `method: ${normalizeInline(input.method)}`,
    `path: ${normalizeInline(input.path, 180)}`,
    `accountId: ${input.accountId ?? '-'}`,
    `webUserId: ${input.webUserId ?? '-'}`,
  ];

  await sendTelegramBotMessage(botToken, chatId, lines.join('\n'));
}

export async function trackWebError(input: {
  actor: User;
  message: unknown;
  stack?: unknown;
  path?: unknown;
  metadata?: unknown;
}): Promise<void> {
  const message = normalizeText(input.message);
  if (!message) {
    return;
  }

  await insertErrorLog({
    accountId: input.actor.accountId,
    webUserId: Number(input.actor.id),
    source: 'web',
    path: normalizeText(input.path, 255) || null,
    message,
    stack: normalizeText(input.stack, ERROR_STACK_MAX) || null,
    metadata: typeof input.metadata === 'object' && input.metadata !== null
      ? (input.metadata as Record<string, unknown>)
      : null,
  });

  await notifyErrorToTelegram({
    source: 'web',
    message,
    path: normalizeText(input.path, 255) || null,
    accountId: input.actor.accountId,
    webUserId: Number(input.actor.id),
  });

  await cleanupExpiredLogs();
}

export async function trackServerError(input: {
  actor?: User;
  method?: string;
  path?: string;
  error: unknown;
}): Promise<void> {
  const error = input.error instanceof Error ? input.error : new Error('Unknown server error');
  try {
    await insertErrorLog({
      accountId: input.actor?.accountId ?? null,
      webUserId: input.actor ? Number(input.actor.id) : null,
      source: 'server',
      method: input.method?.slice(0, 16) ?? null,
      path: input.path?.slice(0, 255) ?? null,
      message: normalizeText(error.message) || 'Server error',
      stack: normalizeText(error.stack, ERROR_STACK_MAX) || null,
    });

    await notifyErrorToTelegram({
      source: 'server',
      message: normalizeText(error.message) || 'Server error',
      method: input.method?.slice(0, 16) ?? null,
      path: input.path?.slice(0, 255) ?? null,
      accountId: input.actor?.accountId ?? null,
      webUserId: input.actor ? Number(input.actor.id) : null,
    });

    await cleanupExpiredLogs();
  } catch (trackingError) {
    console.error('[error-tracking] trackServerError failed', trackingError);
    console.error('[error-tracking] original server error', error);
  }
}

export async function getErrorLogsForActor(
  actor: User,
  filters: { source?: 'web' | 'server'; accountId?: number },
): Promise<{ items: ErrorLogDto[] }> {
  if (!canManageSystemSettings(actor.role)) {
    throw new Error('FORBIDDEN_ERROR_LOGS_SCOPE');
  }

  const items = await listErrorLogs({
    source: filters.source,
    accountId: filters.accountId,
  });

  return { items: items.map(mapErrorLog) };
}
