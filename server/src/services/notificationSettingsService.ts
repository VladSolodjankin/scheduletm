import { ensureAccountNotificationDefaults, findAccountNotificationDefaults } from '../repositories/accountNotificationDefaultsRepository.js';

export const NOTIFICATION_TYPES = ['appointment_created', 'appointment_reminder', 'payment_reminder'] as const;
export const NOTIFICATION_CHANNELS = ['email', 'viber', 'whatsapp', 'sms'] as const;
export const NOTIFICATION_FREQUENCIES = ['immediate', 'daily'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export type AccountNotificationDefault = {
  notificationType: NotificationType;
  preferredChannel: NotificationChannel;
  enabled: boolean;
  sendTimings: string[];
  frequency: NotificationFrequency;
};

const DEFAULTS_BY_TYPE: Record<NotificationType, Omit<AccountNotificationDefault, 'notificationType'>> = {
  appointment_created: {
    preferredChannel: 'email',
    enabled: true,
    sendTimings: ['immediate'],
    frequency: 'immediate',
  },
  appointment_reminder: {
    preferredChannel: 'email',
    enabled: true,
    sendTimings: ['24h', '1h'],
    frequency: 'immediate',
  },
  payment_reminder: {
    preferredChannel: 'email',
    enabled: true,
    sendTimings: ['24h'],
    frequency: 'daily',
  },
};

export function buildDefaultAccountNotificationSettings(): AccountNotificationDefault[] {
  return NOTIFICATION_TYPES.map((notificationType) => ({
    notificationType,
    ...DEFAULTS_BY_TYPE[notificationType],
  }));
}

function parseSendTimings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function getAccountNotificationDefaults(accountId: number): Promise<AccountNotificationDefault[]> {
  await ensureAccountNotificationDefaults(accountId, buildDefaultAccountNotificationSettings());

  const rows = await findAccountNotificationDefaults(accountId);
  return rows
    .map((row) => ({
      notificationType: row.notification_type as NotificationType,
      preferredChannel: row.preferred_channel as NotificationChannel,
      enabled: row.enabled,
      sendTimings: parseSendTimings(row.send_timings),
      frequency: row.frequency as NotificationFrequency,
    }))
    .sort((a, b) => a.notificationType.localeCompare(b.notificationType));
}
