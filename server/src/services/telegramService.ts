import axios from 'axios';

type TelegramGetMeResponse = {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name?: string;
    username?: string;
  };
};

export type TelegramBotInfo = {
  username: string | null;
  name: string | null;
};

type TelegramSendMessageResponse = {
  ok: boolean;
};

export async function verifyTelegramBotToken(token: string): Promise<TelegramBotInfo | null> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return null;
  }

  try {
    const response = await axios.get<TelegramGetMeResponse>(
      `https://api.telegram.org/bot${trimmedToken}/getMe`,
      { timeout: 8000 },
    );

    if (!response.data.ok) {
      return null;
    }

    return {
      username: response.data.result?.username ?? null,
      name: response.data.result?.first_name ?? null,
    };
  } catch {
    return null;
  }
}

export async function sendTelegramBotMessage(token: string, chatId: string, text: string): Promise<boolean> {
  const trimmedToken = token.trim();
  const trimmedChatId = chatId.trim();
  const trimmedText = text.trim();

  if (!trimmedToken || !trimmedChatId || !trimmedText) {
    return false;
  }

  try {
    const response = await axios.post<TelegramSendMessageResponse>(
      `https://api.telegram.org/bot${trimmedToken}/sendMessage`,
      {
        chat_id: trimmedChatId,
        text: trimmedText,
      },
      { timeout: 8000 },
    );

    return Boolean(response.data.ok);
  } catch {
    return false;
  }
}
