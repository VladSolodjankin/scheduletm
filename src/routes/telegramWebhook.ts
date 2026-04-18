import { Router, Request, Response } from "express";
import { env } from "../config/env";
import { sendMessage, TelegramUpdate } from "../bot/bot";

export const telegramWebhookRouter = Router();

telegramWebhookRouter.post(
  "/telegram/webhook/:secret",
  async (req: Request, res: Response) => {
    const secret = req.params.secret;

    if (secret !== env.webhookSecret) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const update = req.body as TelegramUpdate;

    try {
      if (update.message?.text && update.message.chat?.id) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();

        if (text === "/start") {
          const firstName = update.message.from?.first_name || "друг";
          await sendMessage(
            chatId,
            `Привет, ${firstName}! Это бот записи к психологу.`
          );
        } else {
          await sendMessage(
            chatId,
            "Сообщение получено. Скоро добавим полноценную запись."
          );
        }
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Webhook handling error:", error);
      return res.status(200).json({ ok: true });
    }
  }
);
