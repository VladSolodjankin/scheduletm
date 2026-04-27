import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessageMock = vi.hoisted(() => vi.fn());
const findOrCreateTelegramUserMock = vi.hoisted(() => vi.fn());
const findSessionByUserIdMock = vi.hoisted(() => vi.fn());
const findUserByPhoneOrEmailMock = vi.hoisted(() => vi.fn());
const updateUserByTelegramIdMock = vi.hoisted(() => vi.fn());
const ensureClientWebUserInviteMock = vi.hoisted(() => vi.fn());
const mergeSessionPayloadMock = vi.hoisted(() => vi.fn());
const updateSessionStateMock = vi.hoisted(() => vi.fn());

vi.mock('../../config/env', () => ({
  env: {
    webhookSecret: 'test-secret',
    appUrl: 'http://localhost:3000',
  },
}));

vi.mock('../../bot/bot', () => ({
  sendMessage: sendMessageMock,
  answerCallbackQuery: vi.fn(),
  editMessageText: vi.fn(),
}));

vi.mock('../../services/user.service', () => ({
  findOrCreateTelegramUser: findOrCreateTelegramUserMock,
}));

vi.mock('../../i18n', () => ({
  normalizeLanguageCode: vi.fn(() => 'ru'),
  t: vi.fn((_lang: string, key: string) => key),
}));

vi.mock('../../bot/keyboards', () => ({
  getAppointmentEditInlineKeyboard: vi.fn(),
  getDatesInlineKeyboard: vi.fn(),
  getDatesInlineKeyboardWithPagination: vi.fn(),
  getBookingConfirmationKeyboard: vi.fn(() => undefined),
  getBookingFinalInlineKeyboard: vi.fn(() => undefined),
  getLanguageKeyboard: vi.fn(() => undefined),
  getMainMenuKeyboard: vi.fn(() => undefined),
  getMultiSessionModeKeyboard: vi.fn(() => undefined),
  getMyAppointmentsInlineKeyboard: vi.fn(() => undefined),
  getPhoneRequestKeyboard: vi.fn(() => undefined),
  getServicesInlineKeyboard: vi.fn(() => undefined),
  getSpecialistsInlineKeyboard: vi.fn(() => undefined),
  getTimeSlotsInlineKeyboard: vi.fn(() => undefined),
}));

vi.mock('../../repositories/user.repository', () => ({
  findUserByPhoneOrEmail: findUserByPhoneOrEmailMock,
  updateUserByTelegramId: updateUserByTelegramIdMock,
}));

vi.mock('../../repositories/user-session.repository', () => ({
  findSessionByUserId: findSessionByUserIdMock,
  getSessionPayload: vi.fn(() => ({})),
  mergeSessionPayload: mergeSessionPayloadMock,
  updateSessionState: updateSessionStateMock,
}));

vi.mock('../../services/booking.service', () => ({
  selectService: vi.fn(),
  selectSpecialist: vi.fn(),
  startBooking: vi.fn(),
}));

vi.mock('../../services/slot.service', () => ({ getAvailableSlots: vi.fn() }));
vi.mock('../../services/appointment.service', () => ({
  canEditAppointment: vi.fn(),
  createBookingAppointment: vi.fn(),
  createBookingAppointmentsFromSlots: vi.fn(),
  getUserAppointment: vi.fn(),
  getUserAppointments: vi.fn(),
  rescheduleUserAppointment: vi.fn(),
  cancelUserAppointment: vi.fn(),
}));
vi.mock('../../services/notification.service', () => ({
  cancelAppointmentReminders: vi.fn(),
  queueAppointmentReminder: vi.fn(),
  recreateAppointmentReminders: vi.fn(),
}));
vi.mock('../../services/date.service', () => ({ getNextAvailableDates: vi.fn(() => []) }));
vi.mock('../../repositories/service.repository', () => ({ findServiceById: vi.fn() }));
vi.mock('../../repositories/specialist.repository', () => ({ findSpecialistById: vi.fn() }));
vi.mock('../../repositories/app-settings.repository', () => ({ getDefaultTimezone: vi.fn(() => 'UTC') }));
vi.mock('../../utils/calendar-links', () => ({
  buildAppleCalendarIcs: vi.fn(),
  buildAppleCalendarLink: vi.fn(),
  buildCalendarLink: vi.fn(),
  buildMicrosoftCalendarLink: vi.fn(),
}));
vi.mock('../../services/calendar-sync.service', () => ({
  syncAppointmentRescheduledInExternalCalendars: vi.fn(),
  syncAppointmentsToExternalCalendars: vi.fn(),
}));
vi.mock('../../repositories/processed-update.repository', () => ({
  beginProcessingUpdate: vi.fn(),
  markProcessedUpdate: vi.fn(),
  releaseProcessingUpdate: vi.fn(),
}));
vi.mock('../../monitoring/alerts', () => ({ recordHttp5xx: vi.fn(), recordIncomingUpdate: vi.fn() }));
vi.mock('../../utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock('../../utils/timezone', () => ({ toDateTimeFromUtc: vi.fn(() => ({ date: '2026-01-01', time: '10:00' })) }));
vi.mock('../../services/webUserOnboarding.service', () => ({
  ensureClientWebUserInvite: ensureClientWebUserInviteMock,
}));

import { telegramWebhookRouter } from '../telegramWebhook';
import { UserSessionState } from '../../types/session';

async function postUpdate(payload: unknown) {
  const app = express();
  app.use(express.json());
  app.use(telegramWebhookRouter);

  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  const response = await fetch(`http://127.0.0.1:${port}/telegram/webhook/test-secret`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  server.close();
  return response;
}

describe('telegramWebhook ENTERING_EMAIL flow', () => {
  beforeEach(() => {
    findOrCreateTelegramUserMock.mockResolvedValue({
      isNew: false,
      user: {
        id: 10,
        account_id: 1,
        first_name: 'Ivan',
        username: 'ivan',
        language_code: 'ru',
        timezone: 'UTC',
      },
    });
    findSessionByUserIdMock.mockResolvedValue({ state: UserSessionState.ENTERING_EMAIL });
    ensureClientWebUserInviteMock.mockResolvedValue({ invited: true, skipped: false });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('requires email and does not run onboarding when email is empty', async () => {
    const response = await postUpdate({
      message: {
        chat: { id: 101 },
        from: { id: 5001, first_name: 'Ivan', username: 'ivan' },
        text: '',
      },
    });

    expect(response.status).toBe(200);
    expect(sendMessageMock).toHaveBeenCalledWith(101, 'booking.emailRequired');
    expect(ensureClientWebUserInviteMock).not.toHaveBeenCalled();
    expect(updateUserByTelegramIdMock).not.toHaveBeenCalled();
  });

  it('blocks duplicate email and asks for another one', async () => {
    findUserByPhoneOrEmailMock.mockResolvedValue({ id: 99 });

    const response = await postUpdate({
      message: {
        chat: { id: 101 },
        from: { id: 5001, first_name: 'Ivan', username: 'ivan' },
        text: 'taken@example.com',
      },
    });

    expect(response.status).toBe(200);
    expect(sendMessageMock).toHaveBeenCalledWith(101, 'booking.emailAlreadyInUse');
    expect(ensureClientWebUserInviteMock).not.toHaveBeenCalled();
    expect(updateUserByTelegramIdMock).not.toHaveBeenCalled();
  });

  it('updates client email and triggers web onboarding invite for valid unique email', async () => {
    findUserByPhoneOrEmailMock.mockResolvedValue({ id: 10 });

    const response = await postUpdate({
      message: {
        chat: { id: 101 },
        from: { id: 5001, first_name: 'Ivan', username: 'ivan' },
        text: 'new@example.com',
      },
    });

    expect(response.status).toBe(200);
    expect(updateUserByTelegramIdMock).toHaveBeenCalledWith(1, 5001, { email: 'new@example.com' });
    expect(ensureClientWebUserInviteMock).toHaveBeenCalledWith({
      accountId: 1,
      clientId: 10,
      email: 'new@example.com',
      firstName: 'Ivan',
      telegramUsername: 'ivan',
      timezone: 'UTC',
    });
    expect(sendMessageMock).toHaveBeenCalledWith(101, 'booking.webInviteSent');
    expect(mergeSessionPayloadMock).toHaveBeenCalledWith(1, 10, UserSessionState.CONFIRMING, {
      enteredEmail: 'new@example.com',
    });
  });
});
