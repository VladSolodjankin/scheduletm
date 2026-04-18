import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { sendMessage, TelegramUpdate } from '../bot/bot';
import { findOrCreateTelegramUser } from '../services/user.service';
import { normalizeLanguageCode, t } from '../i18n';
import { getLanguageKeyboard, getMainMenuKeyboard } from '../bot/keyboards';
import { updateUserByTelegramId } from '../repositories/user.repository';
import { startBooking } from '../services/booking.service';

export const telegramWebhookRouter = Router();

telegramWebhookRouter.post(
  '/telegram/webhook/:secret',
  async (req: Request, res: Response) => {
    const secret = req.params.secret;

    if (secret !== env.webhookSecret) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const update = req.body as TelegramUpdate;

    try {
      const message = update.message;
      const text = message?.text?.trim();

      if (!message?.chat?.id || !message.from?.id) {
        return res.status(200).json({ ok: true });
      }

      const chatId = message.chat.id;

      const userResult = await findOrCreateTelegramUser({
        telegramId: message.from.id,
        username: message.from.username,
        firstName: message.from.first_name,
        languageCode: message.from.language_code,
      });

      const user = userResult.user;
      const lang = normalizeLanguageCode(user.language_code);
      const firstName = user.first_name || message.from.first_name || 'friend';

      if (text === '/start') {
        const greeting = userResult.isNew
          ? t(lang, 'start.welcomeNew', { name: firstName })
          : t(lang, 'start.welcomeBack', { name: firstName });

        await sendMessage(chatId, greeting, getMainMenuKeyboard(lang));
        await sendMessage(chatId, t(lang, 'start.chooseAction'));
        return res.status(200).json({ ok: true });
      }

      if (
        text === t(lang, 'common.changeLanguage') ||
        text === 'Русский' ||
        text === 'English'
      ) {
        if (text === 'Русский') {
          await updateUserByTelegramId(message.from.id, { languageCode: 'ru' });
          await sendMessage(chatId, 'Язык переключён на русский.', getMainMenuKeyboard('ru'));
          return res.status(200).json({ ok: true });
        }

        if (text === 'English') {
          await updateUserByTelegramId(message.from.id, { languageCode: 'en' });
          await sendMessage(chatId, 'Language switched to English.', getMainMenuKeyboard('en'));
          return res.status(200).json({ ok: true });
        }

        await sendMessage(chatId, t(lang, 'language.choose'), getLanguageKeyboard());
        return res.status(200).json({ ok: true });
      }

      if (text === t(lang, 'common.book')) {
        const services = await startBooking(user.id);

        if (!services.length) {
          await sendMessage(chatId, t(lang, 'booking.noServices'), getMainMenuKeyboard(lang));
          return res.status(200).json({ ok: true });
        }

        const serviceLines = services.map((service, index) => {
          const serviceName = lang === 'ru' ? service.name_ru : service.name_en;
          return `${index + 1}. ${serviceName}`;
        });

        await sendMessage(
          chatId,
          `${t(lang, 'booking.chooseService')}\n\n${serviceLines.join('\n')}`,
          getMainMenuKeyboard(lang),
        );

        return res.status(200).json({ ok: true });
      }

      await sendMessage(chatId, t(lang, 'start.chooseAction'), getMainMenuKeyboard(lang));
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook handling error:', error);
      return res.status(200).json({ ok: true });
    }
  },
);
