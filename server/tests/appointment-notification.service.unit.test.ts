import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendAppointmentNotificationByType } from '../src/services/appointmentNotificationService.js';

const getEffectiveNotificationSettingMock = vi.hoisted(() => vi.fn());
const findSpecialistByIdMock = vi.hoisted(() => vi.fn());
const sendAppointmentNotificationEmailMock = vi.hoisted(() => vi.fn());
const findCustomBotTokenByAccountIdMock = vi.hoisted(() => vi.fn());
const sendTelegramBotMessageMock = vi.hoisted(() => vi.fn());
const findServiceMock = vi.hoisted(() => vi.fn());
const getOrCreateAppointmentManageUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/notificationSettingsService.js', () => ({
  getEffectiveNotificationSetting: getEffectiveNotificationSettingMock,
}));

vi.mock('../src/repositories/specialistRepository.js', () => ({
  findSpecialistById: findSpecialistByIdMock,
}));

vi.mock('../src/services/emailDeliveryService.js', () => ({
  sendAppointmentNotificationEmail: sendAppointmentNotificationEmailMock,
}));

vi.mock('../src/config/env.js', () => ({
  env: { TELEGRAM_BOT_TOKEN: 'platform-token' },
}));

vi.mock('../src/repositories/telegramBotSettingsRepository.js', () => ({
  findCustomBotTokenByAccountId: findCustomBotTokenByAccountIdMock,
}));

vi.mock('../src/services/telegramService.js', () => ({
  sendTelegramBotMessage: sendTelegramBotMessageMock,
}));

vi.mock('../src/repositories/serviceRepository.js', () => ({
  findService: findServiceMock,
}));

vi.mock('../src/services/appointmentManagementTokenService.js', () => ({
  getOrCreateAppointmentManageUrl: getOrCreateAppointmentManageUrlMock,
}));

describe('appointment notification service unit', () => {
  beforeEach(() => {
    getEffectiveNotificationSettingMock.mockReset();
    findSpecialistByIdMock.mockReset();
    sendAppointmentNotificationEmailMock.mockReset();
    findCustomBotTokenByAccountIdMock.mockReset();
    sendTelegramBotMessageMock.mockReset();
    findServiceMock.mockReset();
    getOrCreateAppointmentManageUrlMock.mockReset();
    findServiceMock.mockResolvedValue({ name: 'Consultation' });
    getOrCreateAppointmentManageUrlMock.mockResolvedValue('https://meetli.cc/appointments/manage/token123');
  });

  it('does not send when notification type disabled', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(
      { notificationType: 'appointment_reminder', preferredChannel: 'email', deliveryChannels: [], enabled: false, sendTimings: ['24h'], frequency: 'immediate', deniedByClient: false },
    );

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date(),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_email: 'a@b.com',
      },
    });

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(sendAppointmentNotificationEmailMock).not.toHaveBeenCalled();
  });

  it('sends via telegram when enabled and client has telegram id + username', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(
      { notificationType: 'appointment_reminder', preferredChannel: 'telegram', deliveryChannels: ['telegram', 'email'], enabled: true, sendTimings: ['24h'], frequency: 'immediate', deniedByClient: false },
    );
    findSpecialistByIdMock.mockResolvedValue({ name: 'Dr. Test' });
    findCustomBotTokenByAccountIdMock.mockResolvedValue('own-token');
    sendTelegramBotMessageMock.mockResolvedValue(true);

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date('2026-04-26T10:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_username: 'client_user',
        client_telegram_id: '12345',
      },
    });

    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('telegram');
    expect(sendTelegramBotMessageMock).toHaveBeenCalledOnce();
    expect(sendTelegramBotMessageMock.mock.calls[0][0]).toBe('own-token');
    expect(sendAppointmentNotificationEmailMock).not.toHaveBeenCalled();
  });

  it('falls back to the platform bot token when the account has no own bot', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(
      { notificationType: 'appointment_reminder', preferredChannel: 'telegram', deliveryChannels: ['telegram'], enabled: true, sendTimings: ['24h'], frequency: 'immediate', deniedByClient: false },
    );
    findSpecialistByIdMock.mockResolvedValue({ name: 'Dr. Test' });
    findCustomBotTokenByAccountIdMock.mockResolvedValue(null);
    sendTelegramBotMessageMock.mockResolvedValue(true);

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date('2026-04-26T10:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_username: 'client_user',
        client_telegram_id: '12345',
      },
    });

    expect(result.delivered).toBe(true);
    expect(sendTelegramBotMessageMock.mock.calls[0][0]).toBe('platform-token');
  });

  it('sends via email when enabled', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(
      { notificationType: 'appointment_reminder', preferredChannel: 'email', deliveryChannels: ['email'], enabled: true, sendTimings: ['24h'], frequency: 'immediate', deniedByClient: false },
    );
    findSpecialistByIdMock.mockResolvedValue({ name: 'Dr. Test' });
    sendAppointmentNotificationEmailMock.mockResolvedValue(true);

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date('2026-04-26T10:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_first_name: 'Ivan',
        client_last_name: 'Petrov',
        client_email: 'a@b.com',
      },
    });

    expect(result.delivered).toBe(true);
    expect(sendAppointmentNotificationEmailMock).toHaveBeenCalledOnce();
    expect(sendAppointmentNotificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: 'Consultation',
        durationMin: 30,
        manageUrl: 'https://meetli.cc/appointments/manage/token123',
      }),
    );
  });

  it('does not create a manage-url token for a cancellation notification', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(
      { notificationType: 'appointment_cancelled', preferredChannel: 'email', deliveryChannels: ['email'], enabled: true, sendTimings: ['24h'], frequency: 'immediate', deniedByClient: false },
    );
    findSpecialistByIdMock.mockResolvedValue({ name: 'Dr. Test' });
    sendAppointmentNotificationEmailMock.mockResolvedValue(true);

    await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_cancelled',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date('2026-04-26T10:00:00.000Z'),
        status: 'cancelled',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_email: 'a@b.com',
      },
    });

    expect(getOrCreateAppointmentManageUrlMock).not.toHaveBeenCalled();
    expect(sendAppointmentNotificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ manageUrl: undefined }),
    );
  });

  it('returns client_deny when denied by client channel override (edge case)', async () => {
    getEffectiveNotificationSettingMock.mockResolvedValue(
      { notificationType: 'appointment_reminder', preferredChannel: 'email', deliveryChannels: [], enabled: false, sendTimings: ['24h'], frequency: 'immediate', deniedByClient: true },
    );

    const result = await sendAppointmentNotificationByType({
      accountId: 1,
      notificationType: 'appointment_reminder',
      appointment: {
        id: 1,
        account_id: 1,
        specialist_id: 1,
        appointment_at: new Date(),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 5,
        service_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        client_email: 'a@b.com',
      },
    });

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('client_deny');
  });
});
