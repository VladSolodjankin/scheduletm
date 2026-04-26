import {
  ensureAccountNotificationDefaults,
  findAccountNotificationDefaults,
  upsertAccountNotificationDefaults,
} from '../repositories/accountNotificationDefaultsRepository.js';
import {
  findSpecialistNotificationSettings,
  upsertSpecialistNotificationSettings,
} from '../repositories/specialistNotificationSettingsRepository.js';
import {
  findClientNotificationSettings,
  upsertClientNotificationSettings,
} from '../repositories/clientNotificationSettingsRepository.js';
import {
  clientNotificationSettingsBatchSchema,
  accountNotificationDefaultsBatchSchema,
  specialistNotificationSettingsBatchSchema,
} from '../config/schemas.js';

export const NOTIFICATION_TYPES = ['appointment_created', 'appointment_reminder', 'payment_reminder'] as const;
export const NOTIFICATION_CHANNELS = ['email', 'telegram', 'viber', 'whatsapp', 'sms'] as const;
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

export type SpecialistNotificationSetting = AccountNotificationDefault;
export type ClientNotificationSetting = {
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
};

export type EffectiveNotificationSetting = {
  notificationType: NotificationType;
  preferredChannel: NotificationChannel;
  deliveryChannels: NotificationChannel[];
  enabled: boolean;
  sendTimings: string[];
  frequency: NotificationFrequency;
  deniedByClient: boolean;
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

export async function putAccountNotificationDefaults(
  accountId: number,
  payload: unknown,
): Promise<AccountNotificationDefault[] | null> {
  const parsed = accountNotificationDefaultsBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  await upsertAccountNotificationDefaults(accountId, parsed.data.items);
  return getAccountNotificationDefaults(accountId);
}

function toAccountLikeSettings(rows: Array<{
  notification_type: string;
  preferred_channel: string;
  enabled: boolean;
  send_timings: unknown;
  frequency: string;
}>): SpecialistNotificationSetting[] {
  return rows.map((row) => ({
    notificationType: row.notification_type as NotificationType,
    preferredChannel: row.preferred_channel as NotificationChannel,
    enabled: row.enabled,
    sendTimings: parseSendTimings(row.send_timings),
    frequency: row.frequency as NotificationFrequency,
  }));
}

export async function getSpecialistNotificationSettings(
  accountId: number,
  specialistId: number,
): Promise<SpecialistNotificationSetting[]> {
  const rows = await findSpecialistNotificationSettings(accountId, specialistId);
  return toAccountLikeSettings(rows).sort((a, b) => a.notificationType.localeCompare(b.notificationType));
}

export async function putSpecialistNotificationSettings(
  accountId: number,
  specialistId: number,
  payload: unknown,
): Promise<SpecialistNotificationSetting[] | null> {
  const parsed = specialistNotificationSettingsBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  await upsertSpecialistNotificationSettings(accountId, specialistId, parsed.data.items);
  return getSpecialistNotificationSettings(accountId, specialistId);
}

export async function getClientNotificationSettings(
  accountId: number,
  clientId: number,
): Promise<ClientNotificationSetting[]> {
  const rows = await findClientNotificationSettings(accountId, clientId);
  return rows
    .map((row) => ({
      notificationType: row.notification_type as NotificationType,
      channel: row.channel as NotificationChannel,
      enabled: row.enabled,
    }))
    .sort((a, b) => a.notificationType.localeCompare(b.notificationType) || a.channel.localeCompare(b.channel));
}

export async function putClientNotificationSettings(
  accountId: number,
  clientId: number,
  payload: unknown,
): Promise<ClientNotificationSetting[] | null> {
  const parsed = clientNotificationSettingsBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  await upsertClientNotificationSettings(accountId, clientId, parsed.data.items);
  return getClientNotificationSettings(accountId, clientId);
}

export async function getEffectiveNotificationSetting(input: {
  accountId: number;
  specialistId: number;
  clientId: number;
  notificationType: NotificationType;
}): Promise<EffectiveNotificationSetting | null> {
  const accountSettings = await getAccountNotificationDefaults(input.accountId);
  const channelPriority = NOTIFICATION_CHANNELS;
  const accountBaseItems = accountSettings
    .filter((item) => item.notificationType === input.notificationType)
    .sort((a, b) => channelPriority.indexOf(a.preferredChannel) - channelPriority.indexOf(b.preferredChannel));
  const accountBase = accountBaseItems[0];
  if (!accountBase) {
    return null;
  }

  const specialistSettings = await getSpecialistNotificationSettings(input.accountId, input.specialistId);
  const specialistItems = specialistSettings
    .filter((item) => item.notificationType === input.notificationType)
    .sort((a, b) => channelPriority.indexOf(a.preferredChannel) - channelPriority.indexOf(b.preferredChannel));
  const pickedItems = specialistItems.length > 0 ? specialistItems : accountBaseItems;
  const picked = pickedItems[0];

  const clientSettings = await getClientNotificationSettings(input.accountId, input.clientId);
  const deniedChannels = new Set(
    clientSettings
      .filter((item) => item.notificationType === input.notificationType && !item.enabled)
      .map((item) => item.channel),
  );
  const deliveryChannels = pickedItems
    .filter((item) => item.enabled && !deniedChannels.has(item.preferredChannel))
    .map((item) => item.preferredChannel);

  return {
    ...picked,
    deliveryChannels,
    enabled: picked.enabled && deliveryChannels.length > 0,
    deniedByClient: !deliveryChannels.includes(picked.preferredChannel),
  };
}
