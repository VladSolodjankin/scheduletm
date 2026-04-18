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
  getBookingConfirmationKeyboard,
  getLanguageKeyboard,
  getMainMenuKeyboard,
  getPhoneRequestKeyboard,
  getServicesInlineKeyboard,
  getSpecialistsInlineKeyboard,
  getTimeSlotsInlineKeyboard,
} from '../bot/keyboards';
import { updateUserByTelegramId } from '../repositories/user.repository';
import {
  selectService,
  selectSpecialist,
  startBooking,
} from '../services/booking.service';
import { UserSessionState } from '../types/session';
import { getAvailableSlots } from '../services/slot.service';
import {
  findSessionByUserId,
  getSessionPayload,
  mergeSessionPayload,
  updateSessionState,
} from '../repositories/user-session.repository';
import { findServiceById } from '../repositories/service.repository';
import { findSpecialistById } from '../repositories/specialist.repository';
import { createBookingAppointment } from '../services/appointment.service';
import { sendBookingStubNotification } from '../services/notification.service';

export const telegramWebhookRouter = Router();

function buildCalendarLink(date: string, time: string, title: string) {
  const compactDate = date.replace(/-/g, '');
  const compactTime = time.replace(':', '');
  const start = `${compactDate}T${compactTime}00Z`;
  const [hours, minutes] = time.split(':').map(Number);
  const endDateTime = new Date(`${date}T${time}:00.000Z`);
  endDateTime.setUTCHours(hours + 1, minutes, 0, 0);
  const end = `${compactDate}T${String(endDateTime.getUTCHours()).padStart(2, '0')}${String(
    endDateTime.getUTCMinutes(),
  ).padStart(2, '0')}00Z`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function buildConfirmationText(userId: number, lang: 'ru' | 'en') {
  const payload = await getSessionPayload(userId);

  if (
    !payload.serviceId ||
    !payload.specialistId ||
    !payload.selectedDate ||
    !payload.selectedTime
  ) {
    return null;
  }

  const [service, specialist] = await Promise.all([
    findServiceById(payload.serviceId),
    findSpecialistById(payload.specialistId),
  ]);

  if (!service || !specialist) {
    return null;
  }

  const serviceName = lang === 'ru' ? service.name_ru : service.name_en;
  const contacts: string[] = [];
  if (payload.enteredPhone) contacts.push(payload.enteredPhone);
  if (payload.enteredEmail) contacts.push(payload.enteredEmail);

  const contactLabel = contacts.length ? contacts.join(', ') : t(lang, 'booking.contactNone');

  const lines = [
    t(lang, 'booking.confirmTitle'),
    t(lang, 'booking.confirmService', { value: serviceName }),
    t(lang, 'booking.confirmSpecialist', { value: specialist.name }),
    t(lang, 'booking.confirmDate', { value: payload.selectedDate }),
    t(lang, 'booking.confirmTime', { value: payload.selectedTime }),
    t(lang, 'booking.confirmContact', { value: contactLabel }),
    '',
    t(lang, 'booking.confirmPrompt'),
  ];

  return {
    text: lines.join('\n'),
    payload,
    serviceName,
  };
}

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
          const payload = await getSessionPayload(user.id);

          await mergeSessionPayload(user.id, UserSessionState.CHOOSING_TIME, {
            selectedDate,
          });

          if (!payload.serviceId || !payload.specialistId) {
            await answerCallbackQuery(callback.id, 'Booking session expired');
            return res.status(200).json({ ok: true });
          }

          const availableSlots = await getAvailableSlots({
            date: selectedDate,
            serviceId: payload.serviceId,
            specialistId: payload.specialistId,
          });

          if (!availableSlots.length) {
            await answerCallbackQuery(callback.id);
            await editMessageText(
              chatId,
              messageId,
              `${t(lang, 'booking.chooseDate')} ${selectedDate}\n\n${t(
                lang,
                'booking.noSlots',
              )}`,
            );
            return res.status(200).json({ ok: true });
          }

          await answerCallbackQuery(callback.id, selectedDate);
          await editMessageText(
            chatId,
            messageId,
            `${t(lang, 'booking.chooseDate')} ${selectedDate}\n\n${t(
              lang,
              'booking.chooseTime',
            )}`,
            getTimeSlotsInlineKeyboard(availableSlots),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('time_')) {
          const hh = data.slice('time_'.length, 'time_'.length + 2);
          const mm = data.slice('time_'.length + 2, 'time_'.length + 4);
          const selectedTime = `${hh}:${mm}`;

          const nextState = user.phone
            ? user.email
              ? UserSessionState.CONFIRMING
              : UserSessionState.ENTERING_EMAIL
            : UserSessionState.ENTERING_PHONE;

          await mergeSessionPayload(user.id, nextState, {
            selectedTime,
            enteredName: user.first_name ?? callback.from.first_name ?? undefined,
            enteredPhone: user.phone ?? undefined,
            enteredEmail: user.email ?? undefined,
          });

          await answerCallbackQuery(callback.id, selectedTime);
          await editMessageText(
            chatId,
            messageId,
            `${t(lang, 'booking.chooseTime')} ${selectedTime}`,
          );

          if (nextState === UserSessionState.ENTERING_PHONE) {
            await sendMessage(chatId, t(lang, 'booking.enterPhone'), getPhoneRequestKeyboard(lang));
            return res.status(200).json({ ok: true });
          }

          if (nextState === UserSessionState.ENTERING_EMAIL) {
            await sendMessage(
              chatId,
              t(lang, 'booking.enterEmail'),
              {
                keyboard: [[{ text: t(lang, 'booking.skipPhone') }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            );
            return res.status(200).json({ ok: true });
          }

          const confirmData = await buildConfirmationText(user.id, lang);
          if (confirmData) {
            await sendMessage(chatId, confirmData.text, getBookingConfirmationKeyboard());
          } else {
            await sendMessage(chatId, t(lang, 'booking.sessionExpired'), getMainMenuKeyboard(lang));
          }

          return res.status(200).json({ ok: true });
        }

        if (data === 'confirm:edit') {
          const services = await startBooking(user.id);
          await answerCallbackQuery(callback.id);

          if (!services.length) {
            await editMessageText(chatId, messageId, t(lang, 'booking.noServices'));
            return res.status(200).json({ ok: true });
          }

          await editMessageText(
            chatId,
            messageId,
            t(lang, 'booking.restart'),
            getServicesInlineKeyboard(services, lang),
          );

          return res.status(200).json({ ok: true });
        }

        if (data === 'confirm:yes') {
          const confirmData = await buildConfirmationText(user.id, lang);
          if (!confirmData) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          const { payload, serviceName } = confirmData;
          const appointmentResult = await createBookingAppointment({
            userId: user.id,
            serviceId: payload.serviceId!,
            specialistId: payload.specialistId!,
            selectedDate: payload.selectedDate!,
            selectedTime: payload.selectedTime!,
          });

          if (!appointmentResult.ok) {
            await answerCallbackQuery(callback.id, 'Service not found');
            return res.status(200).json({ ok: true });
          }

          await updateSessionState(user.id, UserSessionState.IDLE, {});
          await answerCallbackQuery(callback.id, t(lang, 'booking.created'));
          await editMessageText(chatId, messageId, t(lang, 'booking.created'));

          const calendarUrl = buildCalendarLink(
            payload.selectedDate!,
            payload.selectedTime!,
            serviceName,
          );
          const paymentUrl = `https://example.com/pay/${appointmentResult.appointment.id}`;

          await sendMessage(chatId, t(lang, 'booking.calendarLink', { url: calendarUrl }));
          await sendMessage(chatId, t(lang, 'booking.paymentLink', { url: paymentUrl }));
          await sendMessage(chatId, t(lang, 'start.chooseAction'), getMainMenuKeyboard(lang));

          await sendBookingStubNotification({
            chatId,
            languageCode: user.language_code,
            hasPhone: Boolean(payload.enteredPhone || user.phone),
            hasEmail: Boolean(payload.enteredEmail || user.email),
            selectedDate: payload.selectedDate!,
            selectedTime: payload.selectedTime!,
            serviceName,
          });

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
      const session = await findSessionByUserId(user.id);
      const state = (session?.state as UserSessionState | undefined) ?? UserSessionState.IDLE;

      if (state === UserSessionState.ENTERING_PHONE) {
        const skipText = t(lang, 'booking.skipPhone');
        const phoneFromContact = message.contact?.phone_number;
        const normalizedText = text ?? '';
        const enteredPhone = normalizedText === skipText ? undefined : phoneFromContact;

        if (!phoneFromContact && normalizedText !== skipText) {
          await sendMessage(chatId, t(lang, 'booking.enterPhone'), getPhoneRequestKeyboard(lang));
          return res.status(200).json({ ok: true });
        }

        if (enteredPhone) {
          await updateUserByTelegramId(message.from.id, { phone: enteredPhone });
        }

        await mergeSessionPayload(user.id, UserSessionState.ENTERING_EMAIL, {
          enteredPhone,
          enteredName: user.first_name ?? message.from.first_name ?? undefined,
        });

        await sendMessage(
          chatId,
          t(lang, 'booking.enterEmail'),
          {
            keyboard: [[{ text: t(lang, 'booking.skipPhone') }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        );

        return res.status(200).json({ ok: true });
      }

      if (state === UserSessionState.ENTERING_EMAIL) {
        const skipText = t(lang, 'booking.skipPhone');
        const normalizedText = text ?? '';
        const enteredEmail = normalizedText === skipText ? undefined : normalizedText;
        const isValidEmail =
          !enteredEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail);

        if (!isValidEmail) {
          await sendMessage(chatId, t(lang, 'booking.enterEmail'));
          return res.status(200).json({ ok: true });
        }

        if (enteredEmail) {
          await updateUserByTelegramId(message.from.id, { email: enteredEmail });
        }

        await mergeSessionPayload(user.id, UserSessionState.CONFIRMING, {
          enteredEmail,
        });

        const confirmData = await buildConfirmationText(user.id, lang);
        if (!confirmData) {
          await updateSessionState(user.id, UserSessionState.IDLE, {});
          await sendMessage(chatId, t(lang, 'booking.sessionExpired'), getMainMenuKeyboard(lang));
          return res.status(200).json({ ok: true });
        }

        await sendMessage(
          chatId,
          confirmData.text,
          getBookingConfirmationKeyboard(),
        );

        return res.status(200).json({ ok: true });
      }

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
      const detail = error instanceof Error ? error.message : String(error);
      console.error('Webhook handling error:', detail);
      return res.status(200).json({ ok: true });
    }
  },
);
