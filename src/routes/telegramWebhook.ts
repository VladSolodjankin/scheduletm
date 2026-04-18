import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
  TelegramUpdate,
} from '../bot/bot';
import { findOrCreateTelegramUser } from '../services/user.service';
import { normalizeLanguageCode, t } from '../i18n';
import {
  getDatesInlineKeyboard,
  getLanguageKeyboard,
  getMainMenuKeyboard,
  getServicesInlineKeyboard,
  getSpecialistsInlineKeyboard,
} from '../bot/keyboards';
import { updateUserByTelegramId } from '../repositories/user.repository';
import {
  selectService,
  selectSpecialist,
  startBooking,
} from '../services/booking.service';

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
      if (update.callback_query) {
        const callback = update.callback_query;
        const data = callback.data;
        const chatId = callback.message?.chat.id;
        const messageId = callback.message?.message_id;

        if (!data || !chatId || !messageId) {
          return res.status(200).json({ ok: true });
        }

        const userResult = await findOrCreateTelegramUser({
          telegramId: callback.from.id,
          username: callback.from.username,
          firstName: callback.from.first_name,
          languageCode: callback.from.language_code,
        });

        const user = userResult.user;
        const lang = normalizeLanguageCode(user.language_code);

        if (data.startsWith('service:')) {
          const serviceId = Number(data.split(':')[1]);

          const result = await selectService(user.id, serviceId);

          if (!result.ok) {
            await answerCallbackQuery(callback.id, 'Service not found');
            return res.status(200).json({ ok: true });
          }

          if (result.skipSpecialist) {
            const serviceName =
              lang === 'ru' ? result.service.name_ru : result.service.name_en;

            await editMessageText(
              chatId,
              messageId,
              `${t(lang, 'booking.serviceSelected', { name: serviceName })}\n${t(
                lang,
                'booking.specialistSelected',
                { name: result.specialist.name },
              )}\n\n${t(lang, 'booking.chooseDate')}`,
              getDatesInlineKeyboard(result.dates),
            );

            await answerCallbackQuery(callback.id);
            return res.status(200).json({ ok: true });
          }

          await editMessageText(
            chatId,
            messageId,
            t(lang, 'booking.chooseSpecialist'),
            getSpecialistsInlineKeyboard(result.specialists),
          );

          await answerCallbackQuery(callback.id);
          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('specialist:')) {
          const specialistId = Number(data.split(':')[1]);

          const result = await selectSpecialist(user.id, specialistId);

          if (!result.ok) {
            await answerCallbackQuery(callback.id, 'Specialist not found');
            return res.status(200).json({ ok: true });
          }

          await editMessageText(
            chatId,
            messageId,
            `${t(lang, 'booking.specialistSelected', { name: result.specialist.name })}\n\n${t(
              lang,
              'booking.chooseDate',
            )}`,
            getDatesInlineKeyboard(result.dates),
          );

          await answerCallbackQuery(callback.id);
          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('date:')) {
          const selectedDate = data.split(':')[1];

          await answerCallbackQuery(callback.id, selectedDate);
          await editMessageText(
            chatId,
            messageId,
            `${t(lang, 'booking.chooseDate')} ${selectedDate}`,
          );

          return res.status(200).json({ ok: true });
        }

        await answerCallbackQuery(callback.id);
        return res.status(200).json({ ok: true });
      }

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

        await sendMessage(
          chatId,
          t(lang, 'booking.chooseService'),
          getServicesInlineKeyboard(services, lang),
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
