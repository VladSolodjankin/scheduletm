import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAppointmentNotificationByType } from '../src/services/appointmentNotificationService.js';

const getEffectiveNotificationSettingMock = vi.hoisted(() => vi.fn());
const findSpecialistByIdMock = vi.hoisted(() => vi.fn());
const sendEmailMock = vi.hoisted(() => vi.fn());
const findCustomBotTokenMock = vi.hoisted(() => vi.fn());
const sendTelegramMock = vi.hoisted(() => vi.fn());
const findServiceMock = vi.hoisted(() => vi.fn());
const findFreshAppointmentMock = vi.hoisted(() => vi.fn());
const evaluateMock = vi.hoisted(() => vi.fn());
const createPayUrlMock = vi.hoisted(() => vi.fn());
const localeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/notificationSettingsService.js', () => ({ getEffectiveNotificationSetting: getEffectiveNotificationSettingMock }));
vi.mock('../src/repositories/specialistRepository.js', () => ({ findSpecialistById: findSpecialistByIdMock }));
vi.mock('../src/services/emailDeliveryService.js', () => ({ sendAppointmentNotificationEmail: sendEmailMock }));
vi.mock('../src/config/env.js', () => ({ env: { TELEGRAM_BOT_TOKEN: 'platform-token' } }));
vi.mock('../src/repositories/telegramBotSettingsRepository.js', () => ({ findCustomBotTokenByAccountId: findCustomBotTokenMock }));
vi.mock('../src/services/telegramService.js', () => ({ sendTelegramBotMessage: sendTelegramMock }));
vi.mock('../src/repositories/serviceRepository.js', () => ({ findService: findServiceMock }));
vi.mock('../src/repositories/appointmentRepository.js', () => ({ findAppointmentByIdAnyAccount: findFreshAppointmentMock }));
vi.mock('../src/services/appointmentManagementTokenService.js', () => ({ getOrCreateAppointmentManageUrl: vi.fn() }));
vi.mock('../src/services/paymentReminderService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/paymentReminderService.js')>('../src/services/paymentReminderService.js');
  return {
    ...actual,
    evaluatePaymentReminderEligibility: evaluateMock,
    createPayUrl: createPayUrlMock,
    resolveAccountNotificationLocale: localeMock,
  };
});

const baseAppointment = {
  id: 9, account_id: 1, specialist_id: 1, appointment_at: new Date('2026-04-26T10:00:00.000Z'), status: 'new' as const,
  comment: null, duration_min: 30, is_paid: false, price: 1500, currency: 'RUB', user_id: 5, service_id: 1,
  created_at: new Date(), updated_at: new Date(), client_email: 'a@b.com', client_username: 'u', client_telegram_id: '123',
  meeting_provider: 'offline' as const,
};

const methods = {
  onlineProvider: 'yookassa' as const,
  manual: { bankTransfer: { text: 'IBAN 123' }, customLink: null, cash: null },
};

describe('payment_reminder delivery', () => {
  beforeEach(() => {
    for (const mock of [getEffectiveNotificationSettingMock, findSpecialistByIdMock, sendEmailMock, findCustomBotTokenMock, sendTelegramMock, findServiceMock, findFreshAppointmentMock, evaluateMock, createPayUrlMock, localeMock]) {
      mock.mockReset();
    }
    findSpecialistByIdMock.mockResolvedValue({ name: 'Dr. Test', timezone: 'UTC' });
    findServiceMock.mockResolvedValue({ name: 'Consultation' });
    findFreshAppointmentMock.mockResolvedValue({ ...baseAppointment });
    localeMock.mockResolvedValue('en');
    createPayUrlMock.mockResolvedValue('https://app.test/pay/tok');
    evaluateMock.mockResolvedValue({ eligible: true, amount: 1500, currency: 'RUB', methods, payOnline: true });
    sendEmailMock.mockResolvedValue(true);
    sendTelegramMock.mockResolvedValue(true);
  });

  const enabled = (channels: Array<'email' | 'telegram'>) => ({
    notificationType: 'payment_reminder', preferredChannel: channels[0], deliveryChannels: channels, enabled: true,
    sendTimings: ['24h'], frequency: 'immediate', deniedByClient: false,
  });

  it('puts the amount, pay link and manual methods into the email', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(enabled(['email']));
    const result = await sendAppointmentNotificationByType({ accountId: 1, appointment: baseAppointment, notificationType: 'payment_reminder' });
    expect(result).toEqual({ delivered: true, channel: 'email' });
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'en',
      notificationType: 'payment_reminder',
      manageUrl: undefined,
      payment: expect.objectContaining({ payUrl: 'https://app.test/pay/tok', bankTransferText: 'IBAN 123', customLink: null, cashComment: null }),
    }));
  });

  it('sends the localized payment text over telegram', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(enabled(['telegram']));
    await sendAppointmentNotificationByType({ accountId: 1, appointment: baseAppointment, notificationType: 'payment_reminder' });
    const text = sendTelegramMock.mock.calls[0][2] as string;
    expect(text).toContain('Payment reminder');
    expect(text).toContain('https://app.test/pay/tok');
    expect(text).toContain('IBAN 123');
  });

  it('omits the pay link when only manual methods are usable', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(enabled(['email']));
    evaluateMock.mockResolvedValue({ eligible: true, amount: 1500, currency: 'RUB', methods, payOnline: false });
    await sendAppointmentNotificationByType({ accountId: 1, appointment: baseAppointment, notificationType: 'payment_reminder' });
    expect(createPayUrlMock).not.toHaveBeenCalled();
    expect(sendEmailMock.mock.calls[0][0].payment.payUrl).toBeNull();
  });

  it.each([
    ['paid meanwhile', { eligible: false, reason: 'paid' }],
    ['no method', { eligible: false, reason: 'no_method' }],
    ['zero amount', { eligible: false, reason: 'no_amount' }],
  ])('does not send when the defensive gate rejects (%s)', async (_name, verdict) => {
    getEffectiveNotificationSettingMock.mockResolvedValue(enabled(['email', 'telegram']));
    evaluateMock.mockResolvedValue(verdict);
    const result = await sendAppointmentNotificationByType({ accountId: 1, appointment: baseAppointment, notificationType: 'payment_reminder' });
    expect(result).toEqual({ delivered: false, channel: null, reason: 'payment_not_required' });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it('re-checks the current is_paid state right before sending', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(enabled(['email']));
    findFreshAppointmentMock.mockResolvedValue({ ...baseAppointment, is_paid: true });
    await sendAppointmentNotificationByType({ accountId: 1, appointment: baseAppointment, notificationType: 'payment_reminder' });
    expect(evaluateMock).toHaveBeenCalledWith(expect.objectContaining({ is_paid: true }));
  });
});
