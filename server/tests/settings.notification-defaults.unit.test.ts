import { describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_TYPES,
  buildDefaultAccountNotificationSettings,
  getAccountNotificationDefaults,
  getEffectiveNotificationSetting,
} from '../src/services/notificationSettingsService.js';

const ensureAccountNotificationDefaultsMock = vi.hoisted(() => vi.fn());
const findAccountNotificationDefaultsMock = vi.hoisted(() => vi.fn());
const findSpecialistNotificationSettingsMock = vi.hoisted(() => vi.fn());
const upsertSpecialistNotificationSettingsMock = vi.hoisted(() => vi.fn());
const findClientNotificationSettingsMock = vi.hoisted(() => vi.fn());
const upsertClientNotificationSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/accountNotificationDefaultsRepository.js', () => ({
  ensureAccountNotificationDefaults: ensureAccountNotificationDefaultsMock,
  findAccountNotificationDefaults: findAccountNotificationDefaultsMock,
}));

vi.mock('../src/repositories/specialistNotificationSettingsRepository.js', () => ({
  findSpecialistNotificationSettings: findSpecialistNotificationSettingsMock,
  upsertSpecialistNotificationSettings: upsertSpecialistNotificationSettingsMock,
}));

vi.mock('../src/repositories/clientNotificationSettingsRepository.js', () => ({
  findClientNotificationSettings: findClientNotificationSettingsMock,
  upsertClientNotificationSettings: upsertClientNotificationSettingsMock,
}));

describe('notification defaults unit', () => {
  it('builds complete MVP defaults for all notification types', () => {
    const defaults = buildDefaultAccountNotificationSettings();

    expect(defaults).toHaveLength(NOTIFICATION_TYPES.length);
    expect(defaults.map((item) => item.notificationType).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it('returns parsed send timings and sorts by notification type', async () => {
    findAccountNotificationDefaultsMock.mockResolvedValue([
      {
        notification_type: 'payment_reminder',
        preferred_channel: 'email',
        enabled: true,
        send_timings: '["24h"]',
        frequency: 'daily',
      },
      {
        notification_type: 'appointment_created',
        preferred_channel: 'email',
        enabled: true,
        send_timings: ['immediate'],
        frequency: 'immediate',
      },
    ]);

    const items = await getAccountNotificationDefaults(11);

    expect(ensureAccountNotificationDefaultsMock).toHaveBeenCalledOnce();
    expect(items[0]?.notificationType).toBe('appointment_created');
    expect(items[1]?.sendTimings).toEqual(['24h']);
  });

  it('handles invalid send timings payload as empty array', async () => {
    findAccountNotificationDefaultsMock.mockResolvedValue([
      {
        notification_type: 'appointment_reminder',
        preferred_channel: 'email',
        enabled: true,
        send_timings: '{invalid json}',
        frequency: 'immediate',
      },
    ]);

    const items = await getAccountNotificationDefaults(11);
    expect(items[0]?.sendTimings).toEqual([]);
  });

  it('resolves effective with specialist override over account defaults', async () => {
    findAccountNotificationDefaultsMock.mockResolvedValue([
      { notification_type: 'appointment_reminder', preferred_channel: 'email', enabled: true, send_timings: ['24h'], frequency: 'immediate' },
    ]);
    findSpecialistNotificationSettingsMock.mockResolvedValue([
      { notification_type: 'appointment_reminder', preferred_channel: 'email', enabled: false, send_timings: ['1h'], frequency: 'immediate' },
    ]);
    findClientNotificationSettingsMock.mockResolvedValue([]);

    const effective = await getEffectiveNotificationSetting({
      accountId: 1,
      specialistId: 2,
      clientId: 3,
      notificationType: 'appointment_reminder',
    });

    expect(effective?.enabled).toBe(false);
    expect(effective?.sendTimings).toEqual(['1h']);
  });

  it('resolves client deny over enabled specialist/account config (edge case)', async () => {
    findAccountNotificationDefaultsMock.mockResolvedValue([
      { notification_type: 'appointment_reminder', preferred_channel: 'email', enabled: true, send_timings: ['24h'], frequency: 'immediate' },
    ]);
    findSpecialistNotificationSettingsMock.mockResolvedValue([]);
    findClientNotificationSettingsMock.mockResolvedValue([
      { notification_type: 'appointment_reminder', channel: 'email', enabled: false },
    ]);

    const effective = await getEffectiveNotificationSetting({
      accountId: 1,
      specialistId: 2,
      clientId: 3,
      notificationType: 'appointment_reminder',
    });

    expect(effective?.enabled).toBe(false);
    expect(effective?.deniedByClient).toBe(true);
  });
});
