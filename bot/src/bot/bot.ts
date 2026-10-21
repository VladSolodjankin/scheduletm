import axios from 'axios';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../config/env';

const TELEGRAM_API_TIMEOUT_MS = 10000;

const tokenContext = new AsyncLocalStorage<{ token: string }>();

/** Runs `fn` so every Telegram call inside it uses `token` (an account's own bot) instead of the shared one. */
export function runWithBotToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return tokenContext.run({ token }, fn);
}

function getTelegramBotToken() {
  const scoped = tokenContext.getStore()?.token;
  if (scoped) {
    return scoped;
  }
  if (!env.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }
  return env.telegramBotToken;
}

async function telegramPost<TPayload extends Record<string, unknown>>(method: string, payload: TPayload) {
  const token = getTelegramBotToken();
  return axios.post(`https://api.telegram.org/bot${token}/${method}`, payload, {
    timeout: TELEGRAM_API_TIMEOUT_MS,
  });
}

async function telegramGet(method: string) {
  const token = getTelegramBotToken();
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
  const webhookUrl = `${env.appUrl}/telegram/webhook/${env.webhookSecret}`;
  const response = await telegramPost('setWebhook', { url: webhookUrl });
  return response.data;
}

/** Registers the webhook of an account's own bot; Telegram echoes `secretToken` in a header on every update. */
export async function setCustomBotWebhook(token: string, accountId: number, secretToken: string) {
  const response = await runWithBotToken(token, () => telegramPost('setWebhook', {
    url: `${env.appUrl}/telegram/bot/${accountId}`,
    secret_token: secretToken,
  }));
  return response.data;
}

export async function getWebhookInfo() {
  const response = await telegramGet('getWebhookInfo');
  return response.data;
}
