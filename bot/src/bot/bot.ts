import axios from 'axios';
import { env } from '../config/env';
import { getDefaultAccountId } from '../repositories/account.repository';
import { findActiveTelegramBotTokenByAccountId } from '../repositories/web-user.repository';

const TELEGRAM_API_TIMEOUT_MS = 10000;
const TOKEN_CACHE_TTL_MS = 15000;

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;
let cachedTokenAccountId: number | null = null;

async function getTelegramBotToken() {
  const accountId = await getDefaultAccountId();
  const now = Date.now();

  if (
    cachedToken &&
    cachedTokenAccountId === accountId &&
    now < cachedTokenExpiresAt
  ) {
    return cachedToken;
  }

  const token = await findActiveTelegramBotTokenByAccountId(accountId);
  if (!token) {
    throw new Error('Telegram BOT_TOKEN is not configured in web user settings');
  }

  cachedToken = token;
  cachedTokenAccountId = accountId;
  cachedTokenExpiresAt = now + TOKEN_CACHE_TTL_MS;
  return token;
}

async function telegramPost<TPayload extends Record<string, unknown>>(method: string, payload: TPayload) {
  const token = await getTelegramBotToken();
  return axios.post(`https://api.telegram.org/bot${token}/${method}`, payload, {
    timeout: TELEGRAM_API_TIMEOUT_MS,
  });
}

async function telegramGet(method: string) {
  const token = await getTelegramBotToken();
  return axios.get(`https://api.telegram.org/bot${token}/${method}`, {
    timeout: TELEGRAM_API_TIMEOUT_MS,
  });
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    contact?: {
      phone_number: string;
      first_name: string;
      user_id?: number;
    };
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      username?: string;
      language_code?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
      text?: string;
    };
  };
};

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  await telegramPost('sendMessage', payload);
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  await telegramPost('editMessageText', payload);
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  await telegramPost('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function setWebhook() {
  const accountId = await getDefaultAccountId();
  const token = await findActiveTelegramBotTokenByAccountId(accountId);
  if (!token) {
    throw new Error('Telegram BOT_TOKEN is not configured in web user settings');
  }

  cachedToken = token;
  cachedTokenAccountId = accountId;
  cachedTokenExpiresAt = Date.now() + TOKEN_CACHE_TTL_MS;
  const webhookUrl = `${env.appUrl}/telegram/webhook/${env.webhookSecret}`;
  const response = await telegramPost('setWebhook', { url: webhookUrl });
  return response.data;
}

export async function getWebhookInfo() {
  const response = await telegramGet('getWebhookInfo');
  return response.data;
}
