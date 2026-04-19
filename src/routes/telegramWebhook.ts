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
  getAppointmentEditInlineKeyboard,
  getDatesInlineKeyboard,
  getDatesInlineKeyboardWithPagination,
  getBookingConfirmationKeyboard,
  getBookingFinalInlineKeyboard,
  getLanguageKeyboard,
  getMainMenuKeyboard,
  getMultiSessionModeKeyboard,
  getMyAppointmentsInlineKeyboard,
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
import {
  canEditAppointment,
  createBookingAppointment,
  createBookingAppointmentsFromSlots,
  getUserAppointment,
  getUserAppointments,
  rescheduleUserAppointment,
  cancelUserAppointment,
} from '../services/appointment.service';
import { cancelAppointmentReminders, queueAppointmentReminder, recreateAppointmentReminders } from '../services/notification.service';
import { toDateTimeFromUtc } from '../utils/timezone';
import { getNextAvailableDates } from '../services/date.service';
import { getDefaultTimezone } from '../repositories/app-settings.repository';
import {
  buildAppleCalendarIcs,
  buildAppleCalendarLink,
  buildCalendarLink,
  buildMicrosoftCalendarLink,
} from '../utils/calendar-links';

export const telegramWebhookRouter = Router();

async function buildConfirmationText(accountId: number, userId: number, lang: 'ru' | 'en') {
  const payload = await getSessionPayload(accountId, userId);

  if (
    !payload.serviceId ||
    !payload.specialistId ||
    !payload.selectedDate ||
    !payload.selectedTime
  ) {
    return null;
  }

  const [service, specialist] = await Promise.all([
    findServiceById(accountId, payload.serviceId),
    findSpecialistById(accountId, payload.specialistId),
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
    ...(payload.selectedSlots && payload.selectedSlots.length > 1
      ? [
        t(lang, 'booking.confirmSlotsTitle'),
        ...payload.selectedSlots.map((slot, index) =>
          t(lang, 'booking.confirmSlotItem', {
            index: String(index + 1),
            date: slot.date,
            time: slot.time,
          })),
      ]
      : [
        t(lang, 'booking.confirmDate', { value: payload.selectedDate }),
        t(lang, 'booking.confirmTime', { value: payload.selectedTime }),
      ]),
    t(lang, 'booking.confirmContact', { value: contactLabel }),
    '',
    t(lang, 'booking.confirmPrompt'),
  ];

  return {
    text: lines.join('\n'),
    payload,
    serviceName,
    specialistName: specialist.name,
  };
}

async function buildDatesKeyboardWithPagination(
  accountId: number,
  pageOffset: number,
) {
  const pageSize = 14;
  const dates = await getNextAvailableDates(accountId, pageSize, pageOffset);
  const hasPrevPage = pageOffset > 0;
  const hasNextPage = dates.length === pageSize;

  return getDatesInlineKeyboardWithPagination(
    dates,
    pageOffset,
    hasPrevPage,
    hasNextPage,
  );
}

function buildWeeklySlots(startDate: string, time: string, totalSessions: number) {
  const [year, month, day] = startDate.split('-').map(Number);
  const slots: Array<{ date: string; time: string }> = [];

  for (let i = 0; i < totalSessions; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + i * 7);
    slots.push({ date: date.toISOString().slice(0, 10), time });
  }

  return slots;
}


telegramWebhookRouter.get('/calendar/apple.ics', (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  const time = typeof req.query.time === 'string' ? req.query.time : '';
  const title = typeof req.query.title === 'string' ? req.query.title : 'ScheduleTM booking';
  const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC';
  const durationMinRaw = typeof req.query.durationMin === 'string' ? Number(req.query.durationMin) : 60;
  const durationMin = Number.isFinite(durationMinRaw) ? durationMinRaw : 60;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).send('Invalid date or time');
  }

  const ics = buildAppleCalendarIcs(date, time, title, timezone, durationMin);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="appointment.ics"');
  return res.status(200).send(ics);
});

function buildAppointmentDetailsText(
  lang: 'ru' | 'en',
  timezone: string,
  appointment: {
    appointmentAt: string | Date;
    serviceNameRu: string;
    serviceNameEn: string;
    specialistName: string;
  },
  canEdit: boolean,
) {
  const dateTime = toDateTimeFromUtc(appointment.appointmentAt, timezone);
  const serviceName = lang === 'ru' ? appointment.serviceNameRu : appointment.serviceNameEn;

  return [
    t(lang, 'appointments.detailsTitle'),
    t(lang, 'appointments.detailsService', { value: serviceName }),
    t(lang, 'appointments.detailsSpecialist', { value: appointment.specialistName }),
    t(lang, 'appointments.detailsDate', { value: dateTime.date }),
    t(lang, 'appointments.detailsTime', { value: dateTime.time }),
    '',
    canEdit ? t(lang, 'appointments.editAllowed') : t(lang, 'appointments.editBlocked'),
  ].join('\n');
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
        const timezone = await getDefaultTimezone(user.account_id);

        if (data.startsWith('service:')) {
          const serviceId = Number(data.split(':')[1]);

          const result = await selectService(user.account_id, user.id, serviceId);

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
              await buildDatesKeyboardWithPagination(user.account_id, 0),
            );

            await answerCallbackQuery(callback.id);
            return res.status(200).json({ ok: true });
          }

          await editMessageText(
            chatId,
            messageId,
            t(lang, 'booking.chooseSpecialist'),
            getSpecialistsInlineKeyboard(result.specialists, lang),
          );

          await answerCallbackQuery(callback.id);
          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('specialist:')) {
          const specialistId = Number(data.split(':')[1]);

          const result = await selectSpecialist(user.account_id, user.id, specialistId);

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
            await buildDatesKeyboardWithPagination(user.account_id, 0),
          );

          await answerCallbackQuery(callback.id);
          return res.status(200).json({ ok: true });
        }

        if (data === 'back:services') {
          const services = await startBooking(user.account_id, user.id);
          await answerCallbackQuery(callback.id);

          if (!services.length) {
            await editMessageText(chatId, messageId, t(lang, 'booking.noServices'));
            return res.status(200).json({ ok: true });
          }

          await editMessageText(
            chatId,
            messageId,
            t(lang, 'booking.chooseService'),
            getServicesInlineKeyboard(services, lang),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('multisession:')) {
          const payload = await getSessionPayload(user.account_id, user.id);
          const totalSessions = Math.max(1, Number(payload.totalSessions ?? 1));
          const selectedSlots = payload.selectedSlots ?? [];

          if (totalSessions <= 1 || !selectedSlots.length) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          const firstSlot = selectedSlots[0];
          const mode = data.split(':')[1];

          if (mode === 'same') {
            const autoSlots = buildWeeklySlots(firstSlot.date, firstSlot.time, totalSessions);
            const nextState = user.phone
              ? user.email
                ? UserSessionState.CONFIRMING
                : UserSessionState.ENTERING_EMAIL
              : UserSessionState.ENTERING_PHONE;

            await mergeSessionPayload(user.account_id, user.id, nextState, {
              multiSessionMode: 'same_time',
              selectedSlots: autoSlots,
              currentSlotIndex: totalSessions - 1,
              selectedDate: autoSlots[0].date,
              selectedTime: autoSlots[0].time,
              enteredName: user.first_name ?? callback.from.first_name ?? undefined,
              enteredPhone: user.phone ?? undefined,
              enteredEmail: user.email ?? undefined,
            });

            await answerCallbackQuery(callback.id);
            await editMessageText(chatId, messageId, t(lang, 'booking.allSessionSlotsSelected', {
              total: String(totalSessions),
            }));

            const confirmData = await buildConfirmationText(user.account_id, user.id, lang);
            if (confirmData) {
              await sendMessage(chatId, confirmData.text, getBookingConfirmationKeyboard());
            } else {
              await sendMessage(chatId, t(lang, 'booking.sessionExpired'), getMainMenuKeyboard(lang));
            }
            return res.status(200).json({ ok: true });
          }

          await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_DATE, {
            multiSessionMode: 'custom',
            currentSlotIndex: 1,
            selectedDate: undefined,
            selectedTime: undefined,
            datePageOffset: 0,
          });

          await answerCallbackQuery(callback.id);
          await editMessageText(
            chatId,
            messageId,
            t(lang, 'booking.chooseSessionSlotDate', {
              current: '2',
              total: String(totalSessions),
            }),
            await buildDatesKeyboardWithPagination(user.account_id, 0),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('date_nav:')) {
          const offset = Number(data.split(':')[1] ?? 0);
          const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
          const payload = await getSessionPayload(user.account_id, user.id);

          await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_DATE, {
            datePageOffset: safeOffset,
          });

          const totalSessions = Math.max(1, Number(payload.totalSessions ?? 1));
          const currentSlotIndex = Math.max(0, Number(payload.currentSlotIndex ?? 0));
          const chooseDateLabel = totalSessions > 1
            ? t(lang, 'booking.chooseSessionSlotDate', {
              current: String(currentSlotIndex + 1),
              total: String(totalSessions),
            })
            : t(lang, 'booking.chooseDate');

          await answerCallbackQuery(callback.id);
          await editMessageText(
            chatId,
            messageId,
            chooseDateLabel,
            await buildDatesKeyboardWithPagination(user.account_id, safeOffset),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('date:')) {
          const selectedDate = data.split(':')[1];
          const payload = await getSessionPayload(user.account_id, user.id);
          const totalSessions = Math.max(1, Number(payload.totalSessions ?? 1));
          const currentSlotIndex = Math.max(0, Number(payload.currentSlotIndex ?? 0));

          await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_TIME, {
            selectedDate,
            datePageOffset: payload.datePageOffset ?? 0,
          });

          if (!payload.serviceId || !payload.specialistId) {
            await answerCallbackQuery(callback.id, 'Booking session expired');
            return res.status(200).json({ ok: true });
          }

          const availableSlots = await getAvailableSlots({
            accountId: user.account_id,
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
              )}\n${t(lang, 'booking.slotsTimezoneNote', { timezone })}`,
            );
            return res.status(200).json({ ok: true });
          }

          await answerCallbackQuery(callback.id, selectedDate);
          await editMessageText(
            chatId,
            messageId,
            `${totalSessions > 1
              ? t(lang, 'booking.chooseSessionSlotDate', {
                current: String(currentSlotIndex + 1),
                total: String(totalSessions),
              })
              : t(lang, 'booking.chooseDate')} ${selectedDate}\n\n${t(
                lang,
                'booking.chooseTime',
              )}\n${t(lang, 'booking.slotsTimezoneNote', { timezone })}`,
            getTimeSlotsInlineKeyboard(availableSlots, lang),
          );

          return res.status(200).json({ ok: true });
        }

        if (data === 'time_change_date') {
          const payload = await getSessionPayload(user.account_id, user.id);

          if (!payload.serviceId || !payload.specialistId) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_DATE, {});
          const totalSessions = Math.max(1, Number(payload.totalSessions ?? 1));
          const currentSlotIndex = Math.max(0, Number(payload.currentSlotIndex ?? 0));
          const pageOffset = payload.datePageOffset ?? 0;
          await answerCallbackQuery(callback.id);
          await editMessageText(
            chatId,
            messageId,
            totalSessions > 1
              ? t(lang, 'booking.chooseSessionSlotDate', {
                current: String(currentSlotIndex + 1),
                total: String(totalSessions),
              })
              : t(lang, 'booking.chooseDate'),
            await buildDatesKeyboardWithPagination(user.account_id, pageOffset),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('time_')) {
          const hh = data.slice('time_'.length, 'time_'.length + 2);
          const mm = data.slice('time_'.length + 2, 'time_'.length + 4);
          const selectedTime = `${hh}:${mm}`;
          const payload = await getSessionPayload(user.account_id, user.id);

          if (payload.editingAppointmentId) {
            const rescheduled = await rescheduleUserAppointment({
              accountId: user.account_id,
              userId: user.id,
              appointmentId: payload.editingAppointmentId,
              selectedDate: payload.selectedDate!,
              selectedTime,
            });

            await answerCallbackQuery(callback.id, selectedTime);

            if (!rescheduled.ok) {
              const messageText = rescheduled.reason === 'slot_already_booked'
                ? t(lang, 'booking.slotAlreadyBooked')
                : t(lang, 'appointments.editBlocked');
              await editMessageText(chatId, messageId, messageText);
              await updateSessionState(user.account_id, user.id, UserSessionState.IDLE, {});
              return res.status(200).json({ ok: true });
            }

            await recreateAppointmentReminders({
              accountId: user.account_id,
              appointmentId: payload.editingAppointmentId,
              userId: user.id,
              appointmentAtIso: rescheduled.reminderContext.appointmentAtIso,
              serviceName: lang === 'ru'
                ? rescheduled.reminderContext.serviceNameRu
                : rescheduled.reminderContext.serviceNameEn,
              specialistName: rescheduled.reminderContext.specialistName,
              selectedDate: rescheduled.next.date,
              selectedTime: rescheduled.next.time,
              chatId,
              email: user.email,
              phone: user.phone,
              reminderComment: user.reminder_comment,
            });

            await editMessageText(
              chatId,
              messageId,
              t(lang, 'appointments.rescheduled', {
                date: rescheduled.next.date,
                time: rescheduled.next.time,
              }),
            );

            await updateSessionState(user.account_id, user.id, UserSessionState.IDLE, {});
            await sendMessage(chatId, t(lang, 'start.chooseAction'), getMainMenuKeyboard(lang));
            return res.status(200).json({ ok: true });
          }

          const totalSessions = Math.max(1, Number(payload.totalSessions ?? 1));
          const currentSlotIndex = Math.max(0, Number(payload.currentSlotIndex ?? 0));
          const selectedSlots = payload.selectedSlots ?? [];
          const selectedDate = payload.selectedDate;

          if (!selectedDate) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          if (totalSessions > 1) {
            const slotKey = `${selectedDate}T${selectedTime}`;
            const exists = selectedSlots.some((slot) => `${slot.date}T${slot.time}` === slotKey);

            if (exists) {
              await answerCallbackQuery(callback.id, t(lang, 'booking.slotAlreadySelected'));
              return res.status(200).json({ ok: true });
            }

            const nextSlots = [...selectedSlots, { date: selectedDate, time: selectedTime }];
            const completedCount = nextSlots.length;

            if (selectedSlots.length === 0) {
              await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_DATE, {
                selectedSlots: nextSlots,
                currentSlotIndex: 0,
                selectedDate: undefined,
                selectedTime: undefined,
                datePageOffset: 0,
              });

              await answerCallbackQuery(callback.id, selectedTime);
              await editMessageText(
                chatId,
                messageId,
                `${t(lang, 'booking.sessionSlotSaved', {
                  current: '1',
                  total: String(totalSessions),
                  date: selectedDate,
                  time: selectedTime,
                })}\n\n${t(lang, 'booking.multiSessionModePrompt')}`,
                getMultiSessionModeKeyboard(lang),
              );

              return res.status(200).json({ ok: true });
            }

            if (completedCount < totalSessions) {
              await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_DATE, {
                selectedSlots: nextSlots,
                currentSlotIndex: currentSlotIndex + 1,
                selectedDate: undefined,
                selectedTime: undefined,
                datePageOffset: 0,
              });

              await answerCallbackQuery(callback.id, selectedTime);
              await editMessageText(
                chatId,
                messageId,
                `${t(lang, 'booking.sessionSlotSaved', {
                  current: String(completedCount),
                  total: String(totalSessions),
                  date: selectedDate,
                  time: selectedTime,
                })}\n\n${t(lang, 'booking.chooseSessionSlotDate', {
                  current: String(completedCount + 1),
                  total: String(totalSessions),
                })}`,
                await buildDatesKeyboardWithPagination(user.account_id, 0),
              );

              return res.status(200).json({ ok: true });
            }

            await mergeSessionPayload(
              user.account_id,
              user.id,
              user.phone
                ? user.email
                  ? UserSessionState.CONFIRMING
                  : UserSessionState.ENTERING_EMAIL
                : UserSessionState.ENTERING_PHONE,
              {
                selectedSlots: nextSlots,
                selectedDate: nextSlots[0].date,
                selectedTime: nextSlots[0].time,
                enteredName: user.first_name ?? callback.from.first_name ?? undefined,
                enteredPhone: user.phone ?? undefined,
                enteredEmail: user.email ?? undefined,
              },
            );

            await answerCallbackQuery(callback.id, selectedTime);
            await editMessageText(
              chatId,
              messageId,
              t(lang, 'booking.allSessionSlotsSelected', {
                total: String(totalSessions),
              }),
            );

            const confirmData = await buildConfirmationText(user.account_id, user.id, lang);
            if (confirmData) {
              await sendMessage(chatId, confirmData.text, getBookingConfirmationKeyboard());
            } else {
              await sendMessage(chatId, t(lang, 'booking.sessionExpired'), getMainMenuKeyboard(lang));
            }

            return res.status(200).json({ ok: true });
          }

          const nextState = user.phone
            ? user.email
              ? UserSessionState.CONFIRMING
              : UserSessionState.ENTERING_EMAIL
            : UserSessionState.ENTERING_PHONE;

          await mergeSessionPayload(user.account_id, user.id, nextState, {
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

          const confirmData = await buildConfirmationText(user.account_id, user.id, lang);
          if (confirmData) {
            await sendMessage(chatId, confirmData.text, getBookingConfirmationKeyboard());
          } else {
            await sendMessage(chatId, t(lang, 'booking.sessionExpired'), getMainMenuKeyboard(lang));
          }

          return res.status(200).json({ ok: true });
        }

        if (data === 'confirm:edit') {
          const services = await startBooking(user.account_id, user.id);
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
          const confirmData = await buildConfirmationText(user.account_id, user.id, lang);
          if (!confirmData) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          const { payload, serviceName } = confirmData;
          const appointmentResult = payload.selectedSlots && payload.selectedSlots.length > 0
            ? await createBookingAppointmentsFromSlots({
              accountId: user.account_id,
              userId: user.id,
              serviceId: payload.serviceId!,
              specialistId: payload.specialistId!,
              slots: payload.selectedSlots,
            })
            : await createBookingAppointment({
              accountId: user.account_id,
              userId: user.id,
              serviceId: payload.serviceId!,
              specialistId: payload.specialistId!,
              selectedDate: payload.selectedDate!,
              selectedTime: payload.selectedTime!,
            });

          if (!appointmentResult.ok) {
            const errorText = appointmentResult.reason === 'slot_already_booked'
              ? t(lang, 'booking.slotAlreadyBooked')
              : appointmentResult.reason === 'specialist_not_found'
                ? t(lang, 'booking.specialistNotFound')
                : appointmentResult.reason === 'duplicate_slots'
                  ? t(lang, 'booking.slotAlreadySelected')
              : 'Service not found';
            await answerCallbackQuery(callback.id, errorText);
            await editMessageText(chatId, messageId, errorText);
            return res.status(200).json({ ok: true });
          }

          await updateSessionState(user.account_id, user.id, UserSessionState.IDLE, {});
          await answerCallbackQuery(callback.id, t(lang, 'booking.created'));
          await editMessageText(chatId, messageId, t(lang, 'booking.created'));

          const calendarGoogleUrl = buildCalendarLink(
            payload.selectedDate!,
            payload.selectedTime!,
            serviceName,
            timezone,
            appointmentResult.service.duration_min,
          );
          const calendarAppleUrl = buildAppleCalendarLink(
            env.appUrl,
            payload.selectedDate!,
            payload.selectedTime!,
            serviceName,
            timezone,
            appointmentResult.service.duration_min,
          );
          const calendarMicrosoftUrl = buildMicrosoftCalendarLink(
            payload.selectedDate!,
            payload.selectedTime!,
            serviceName,
            timezone,
            appointmentResult.service.duration_min,
          );
          const paymentUrl = `https://example.com/pay/${appointmentResult.appointment.id}`;

          await sendMessage(
            chatId,
            t(lang, 'booking.finalMessage', {
              created: t(lang, 'booking.created'),
              date: payload.selectedDate!,
              time: payload.selectedTime!,
              specialist: confirmData.specialistName,
            }),
            getBookingFinalInlineKeyboard(
              lang,
              calendarGoogleUrl,
              calendarAppleUrl,
              calendarMicrosoftUrl,
              paymentUrl,
            ),
          );

          await sendMessage(chatId, t(lang, 'start.chooseAction'), getMainMenuKeyboard(lang));

          await Promise.all(
            appointmentResult.appointments.map((appointment) =>
              queueAppointmentReminder({
                accountId: user.account_id,
                appointmentId: appointment.id,
                userId: user.id,
                appointmentAtIso: String(appointment.appointment_at),
                serviceName,
                specialistName: confirmData.specialistName,
                selectedDate: toDateTimeFromUtc(appointment.appointment_at, timezone).date,
                selectedTime: toDateTimeFromUtc(appointment.appointment_at, timezone).time,
                chatId,
                email: payload.enteredEmail || user.email,
                phone: payload.enteredPhone || user.phone,
                reminderComment: user.reminder_comment,
              }),
            ),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('appointment:')) {
          const appointmentId = Number(data.split(':')[1]);
          const appointment = await getUserAppointment(user.account_id, user.id, appointmentId);

          if (!appointment) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          const editable = canEditAppointment(appointment.appointmentAt);
          await answerCallbackQuery(callback.id);
          await editMessageText(
            chatId,
            messageId,
            buildAppointmentDetailsText(lang, timezone, appointment, editable),
            editable ? getAppointmentEditInlineKeyboard(appointment.id, lang) : undefined,
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('appointment_edit:')) {
          const appointmentId = Number(data.split(':')[1]);
          const appointment = await getUserAppointment(user.account_id, user.id, appointmentId);

          if (!appointment) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          const editable = canEditAppointment(appointment.appointmentAt);
          if (!editable) {
            await answerCallbackQuery(callback.id, t(lang, 'appointments.editBlocked'));
            return res.status(200).json({ ok: true });
          }

          await mergeSessionPayload(user.account_id, user.id, UserSessionState.CHOOSING_DATE, {
            editingAppointmentId: appointment.id,
            serviceId: appointment.serviceId,
            specialistId: appointment.specialistId,
          });

          await answerCallbackQuery(callback.id);
          await editMessageText(
            chatId,
            messageId,
            t(lang, 'appointments.chooseNewDate'),
            getDatesInlineKeyboard(await getNextAvailableDates(user.account_id)),
          );

          return res.status(200).json({ ok: true });
        }

        if (data.startsWith('appointment_cancel:')) {
          const appointmentId = Number(data.split(':')[1]);
          const cancelled = await cancelUserAppointment(user.account_id, user.id, appointmentId);

          if (!cancelled.ok) {
            await answerCallbackQuery(callback.id, t(lang, 'booking.sessionExpired'));
            return res.status(200).json({ ok: true });
          }

          await cancelAppointmentReminders(user.account_id, appointmentId);

          await answerCallbackQuery(callback.id, t(lang, 'appointments.cancelled'));
          await editMessageText(chatId, messageId, t(lang, 'appointments.cancelled'));
          await sendMessage(chatId, t(lang, 'start.chooseAction'), getMainMenuKeyboard(lang));

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
      const timezone = await getDefaultTimezone(user.account_id);
      const firstName = user.first_name || message.from.first_name || 'friend';
      const session = await findSessionByUserId(user.account_id, user.id);
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
          await updateUserByTelegramId(user.account_id, message.from.id, { phone: enteredPhone });
        }

        await mergeSessionPayload(user.account_id, user.id, UserSessionState.ENTERING_EMAIL, {
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
          await updateUserByTelegramId(user.account_id, message.from.id, { email: enteredEmail });
        }

        await mergeSessionPayload(user.account_id, user.id, UserSessionState.CONFIRMING, {
          enteredEmail,
        });

        const confirmData = await buildConfirmationText(user.account_id, user.id, lang);
        if (!confirmData) {
          await updateSessionState(user.account_id, user.id, UserSessionState.IDLE, {});
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
        await updateSessionState(user.account_id, user.id, UserSessionState.IDLE, {});
        const greeting = userResult.isNew
          ? t(lang, 'start.welcomeNew', { name: firstName })
          : t(lang, 'start.welcomeBack', { name: firstName });

        await sendMessage(chatId, greeting, getMainMenuKeyboard(lang));
        await sendMessage(chatId, t(lang, 'start.chooseAction'));
        return res.status(200).json({ ok: true });
      }

      if (text === '/reset') {
        await updateSessionState(user.account_id, user.id, UserSessionState.IDLE, {});
        await sendMessage(chatId, t(lang, 'start.sessionReset'), getMainMenuKeyboard(lang));
        await sendMessage(chatId, t(lang, 'start.chooseAction'));
        return res.status(200).json({ ok: true });
      }

      if (
        text === t(lang, 'common.changeLanguage') ||
        text === 'Русский' ||
        text === 'English'
      ) {
        if (text === 'Русский') {
          await updateUserByTelegramId(user.account_id, message.from.id, { languageCode: 'ru' });
          await sendMessage(
            chatId,
            t('ru', 'language.changed'),
            getMainMenuKeyboard('ru'),
          );
          return res.status(200).json({ ok: true });
        }

        if (text === 'English') {
          await updateUserByTelegramId(user.account_id, message.from.id, { languageCode: 'en' });
          await sendMessage(
            chatId,
            t('en', 'language.changed'),
            getMainMenuKeyboard('en'),
          );
          return res.status(200).json({ ok: true });
        }

        await sendMessage(chatId, t(lang, 'language.choose'), getLanguageKeyboard());
        return res.status(200).json({ ok: true });
      }

      if (text === t(lang, 'common.book')) {
        const services = await startBooking(user.account_id, user.id);

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

      if (text === t(lang, 'common.myAppointments')) {
        const appointments = await getUserAppointments(user.account_id, user.id);

        if (!appointments.length) {
          await sendMessage(chatId, t(lang, 'appointments.empty'), getMainMenuKeyboard(lang));
          return res.status(200).json({ ok: true });
        }

        await sendMessage(
          chatId,
          t(lang, 'appointments.listTitle'),
          getMyAppointmentsInlineKeyboard(
            appointments.map((appointment) => {
              const dateTime = toDateTimeFromUtc(appointment.appointmentAt, timezone);
              return {
                id: appointment.id,
                title: t(lang, 'appointments.item', {
                  date: dateTime.date,
                  time: dateTime.time,
                  service:
                    lang === 'ru' ? appointment.serviceNameRu : appointment.serviceNameEn,
                }),
              };
            }),
          ),
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
