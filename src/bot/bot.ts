import axios from 'axios';
import { env } from '../config/env';

const telegramApi = axios.create({
  baseURL: `https://api.telegram.org/bot${env.botToken}`,
  timeout: 10000,
});

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

  await telegramApi.post('/sendMessage', payload);
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

  await telegramApi.post('/editMessageText', payload);
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  await telegramApi.post('/answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function setWebhook() {
  const webhookUrl = `${env.appUrl}/telegram/webhook/${env.webhookSecret}`;
  const response = await telegramApi.post('/setWebhook', { url: webhookUrl });
  return response.data;
}

export async function getWebhookInfo() {
  const response = await telegramApi.get('/getWebhookInfo');
  return response.data;
}
