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
};

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  await telegramApi.post('/sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
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
