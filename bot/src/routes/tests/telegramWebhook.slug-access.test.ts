import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessageMock = vi.hoisted(() => vi.fn());
const answerCallbackQueryMock = vi.hoisted(() => vi.fn());
const startBookingMock = vi.hoisted(() => vi.fn());
const resolveBotAccessMock = vi.hoisted(() => vi.fn());
const findSessionByUserIdMock = vi.hoisted(() => vi.fn());
const findUserByPhoneOrEmailMock = vi.hoisted(() => vi.fn());
const updateUserByTelegramIdMock = vi.hoisted(() => vi.fn());
const ensureClientWebUserInviteMock = vi.hoisted(() => vi.fn());
const mergeSessionPayloadMock = vi.hoisted(() => vi.fn());
const updateSessionStateMock = vi.hoisted(() => vi.fn());
const beginProcessingUpdateMock = vi.hoisted(() => vi.fn());
const acquireTelegramUserLeaseMock = vi.hoisted(() => vi.fn());
const markProcessedUpdateMock = vi.hoisted(() => vi.fn());
const releaseProcessingUpdateMock = vi.hoisted(() => vi.fn());
const releaseTelegramUserLeaseMock = vi.hoisted(() => vi.fn());

vi.mock('../../config/env', () => ({
  env: {
    webhookSecret: 'test-secret',
    appUrl: 'http://localhost:3000',
    sessionStateTtlMs: 30 * 60 * 1000,
  },
}));

vi.mock('../../bot/bot', () => ({
  sendMessage: sendMessageMock,
  answerCallbackQuery: answerCallbackQueryMock,
  editMessageText: vi.fn(),
}));

vi.mock('../../services/bot-access.service', () => ({
  resolveBotAccess: resolveBotAccessMock,
  parseStartCommand: (text?: string) => {
    const match = /^\/start(?:\s+(\S+))?$/.exec(text ?? '');
    return { isStart: Boolean(match), slug: match?.[1] ?? null };
  },
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
  isSessionStateStale: vi.fn(() => false),
  mergeSessionPayload: mergeSessionPayloadMock,
  updateSessionState: updateSessionStateMock,
}));

vi.mock('../../services/booking.service', () => ({
  selectService: vi.fn(),
  selectSpecialist: vi.fn(),
  startBooking: startBookingMock,
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
vi.mock('../../repositories/processed-update.repository', () => ({
  acquireTelegramUserLease: acquireTelegramUserLeaseMock,
  beginProcessingUpdate: beginProcessingUpdateMock,
  cleanupProcessedUpdates: vi.fn(),
  markProcessedUpdate: markProcessedUpdateMock,
  releaseProcessingUpdate: releaseProcessingUpdateMock,
  releaseTelegramUserLease: releaseTelegramUserLeaseMock,
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

const okAccess = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  enabled: true,
  welcomeMessage: null,
  userResult: {
    isNew: false,
    user: {
      id: 10,
      account_id: 1,
      first_name: 'Ivan',
      username: 'ivan',
      language_code: 'ru',
      timezone: 'UTC',
    },
  },
  ...overrides,
});

const startMessage = (text: string) => ({
  message: {
    chat: { id: 101 },
    from: { id: 5001, first_name: 'Ivan', username: 'ivan' },
    text,
  },
});

describe('telegramWebhook slug access', () => {
  beforeEach(() => {
    beginProcessingUpdateMock.mockResolvedValue({ status: 'acquired', processingToken: 'update-owner' });
    acquireTelegramUserLeaseMock.mockResolvedValue('user-owner');
    markProcessedUpdateMock.mockResolvedValue(true);
    releaseProcessingUpdateMock.mockResolvedValue(true);
    releaseTelegramUserLeaseMock.mockResolvedValue(true);
    findSessionByUserIdMock.mockResolvedValue({ state: UserSessionState.IDLE });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends the website hint to users without a bound account and creates nothing', async () => {
    resolveBotAccessMock.mockResolvedValue({ status: 'unbound' });

    const response = await postUpdate(startMessage('/start'));

    expect(response.status).toBe(200);
    expect(sendMessageMock).toHaveBeenCalledWith(101, 'start.unbound');
    expect(updateSessionStateMock).not.toHaveBeenCalled();
  });

  it('tells the user the link is invalid for an unknown slug', async () => {
    resolveBotAccessMock.mockResolvedValue({ status: 'invalid_link' });

    await postUpdate(startMessage('/start nope'));

    expect(resolveBotAccessMock).toHaveBeenCalledWith(expect.objectContaining({ startSlug: 'nope' }));
    expect(sendMessageMock).toHaveBeenCalledWith(101, 'start.invalidLink');
  });

  it('greets with the custom welcome message when the account configured one', async () => {
    resolveBotAccessMock.mockResolvedValue(okAccess({ welcomeMessage: 'Welcome to Anna studio' }));

    await postUpdate(startMessage('/start acme-1'));

    expect(sendMessageMock).toHaveBeenCalledWith(101, 'Welcome to Anna studio', undefined);
  });

  it('falls back to the localized greeting without a custom message', async () => {
    resolveBotAccessMock.mockResolvedValue(okAccess());

    await postUpdate(startMessage('/start acme-1'));

    expect(sendMessageMock).toHaveBeenCalledWith(101, 'start.welcomeBack', undefined);
  });

  it('blocks new bookings from the menu when the bot is disabled', async () => {
    resolveBotAccessMock.mockResolvedValue(okAccess({ enabled: false }));

    await postUpdate(startMessage('common.book'));

    expect(sendMessageMock).toHaveBeenCalledWith(101, 'bot.disabled', undefined);
    expect(startBookingMock).not.toHaveBeenCalled();
  });

  it('blocks starting a booking from a callback when the bot is disabled', async () => {
    resolveBotAccessMock.mockResolvedValue(okAccess({ enabled: false }));

    await postUpdate({
      callback_query: {
        id: 'cb1',
        from: { id: 5001, first_name: 'Ivan' },
        data: 'service:3',
        message: { chat: { id: 101 }, message_id: 7 },
      },
    });

    expect(sendMessageMock).toHaveBeenCalledWith(101, 'bot.disabled', undefined);
    expect(answerCallbackQueryMock).toHaveBeenCalledWith('cb1');
  });
});
