import { describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_TYPES,
  buildDefaultAccountNotificationSettings,
  getAccountNotificationDefaults,
} from '../src/services/notificationSettingsService.js';

const ensureAccountNotificationDefaultsMock = vi.hoisted(() => vi.fn());
const findAccountNotificationDefaultsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/accountNotificationDefaultsRepository.js', () => ({
  ensureAccountNotificationDefaults: ensureAccountNotificationDefaultsMock,
  findAccountNotificationDefaults: findAccountNotificationDefaultsMock,
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
});
