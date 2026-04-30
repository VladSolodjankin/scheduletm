import { findAppSettingsByAccountId, updateAppSettingsByAccountId } from '../repositories/appSettingsRepository.js';
import {
  findAccountSettingsByAccountId,
  updateAccountSettingsByAccountId,
} from '../repositories/accountSettingsRepository.js';
import { findWebUserById, updateWebUserSettings } from '../repositories/webUserRepository.js';
import { findWebUserIntegrationByWebUserId, updateWebUserTelegramIntegration } from '../repositories/webUserIntegrationRepository.js';
import { findUserSettingsByWebUserId, updateUserSettingsByWebUserId } from '../repositories/userSettingsRepository.js';
import { findUserIntegrationByWebUserId, updateUserTelegramIntegration } from '../repositories/userIntegrationRepository.js';
import { getSystemSettingsRecord, updateSystemSettingsRecord } from '../repositories/systemSettingsRepository.js';
import {
  findSpecialistBookingPolicy,
  upsertSpecialistBookingPolicy,
} from '../repositories/specialistBookingPolicyRepository.js';
import type { User } from '../types/domain.js';
import {
  accountSettingsSchema,
  specialistBookingPolicySchema,
  systemSettingsSchema,
  userSettingsSchema,
} from '../config/schemas.js';
import { env } from '../config/env.js';
import { decryptText, encryptText } from '../utils/crypto.js';
import { verifyTelegramBotToken } from './telegramService.js';
import { canManageAccountSettings, canManageSystemSettings } from '../policies/rolePermissions.js';
export { canManageAccountSettings, canManageSystemSettings } from '../policies/rolePermissions.js';
import { findSpecialistById, findSpecialistByWebUserId } from '../repositories/specialistRepository.js';
import { findClientById } from '../repositories/clientRepository.js';
import { WebUserRole } from '../types/webUserRole.js';
import {
  getAccountNotificationDefaults as getAccountNotificationDefaultsCore,
  getClientNotificationSettings as getClientNotificationSettingsCore,
  getEffectiveNotificationSetting as getEffectiveNotificationSettingCore,
  putAccountNotificationDefaults as putAccountNotificationDefaultsCore,
  getSpecialistNotificationSettings as getSpecialistNotificationSettingsCore,
  putClientNotificationSettings as putClientNotificationSettingsCore,
  putSpecialistNotificationSettings as putSpecialistNotificationSettingsCore,
} from './notificationSettingsService.js';

export type SystemSettings = {
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
  refreshTokenTtlDays: number;
  accessTokenTtlSeconds: number;
  sessionCookieName: string;
  errorAlertsTelegramEnabled: boolean;
};

export type AccountSettings = {
  timezone: string;
  locale: string;
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
};

export type UserSettings = {
  timezone: string;
  locale: string;
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
  uiThemeMode: 'light' | 'dark';
  uiPaletteVariantId: string;
  googleConnected: boolean;
  zoomConnected: boolean;
  telegramBotConnected: boolean;
  telegramBotName: string | null;
  telegramBotUsername: string | null;
};

export type SpecialistBookingPolicy = {
  specialistId: number;
  cancelGracePeriodHours: number;
  refundOnLateCancel: boolean;
  autoCancelUnpaidEnabled: boolean;
  unpaidAutoCancelAfterHours: number;
  meetingProvidersPriority: string;
  allowedMeetingProviders: string;
  meetingProviderOverrideEnabled: boolean;
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  refreshTokenTtlDays: 30,
  accessTokenTtlSeconds: 900,
  sessionCookieName: 'meetli_refresh_token',
  errorAlertsTelegramEnabled: false,
};

const mapSystemSettings = async (): Promise<SystemSettings> => {
  const row = await getSystemSettingsRecord();
  if (!row) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  const hasEncryptionKey = Boolean(env.APP_ENCRYPTION_KEY.trim());
  const decryptedBotToken = hasEncryptionKey && row.error_alerts_telegram_bot_token_encrypted
    ? decryptText(row.error_alerts_telegram_bot_token_encrypted, env.APP_ENCRYPTION_KEY)
    : null;
  const decryptedChatId = hasEncryptionKey && row.error_alerts_telegram_chat_id_encrypted
    ? decryptText(row.error_alerts_telegram_chat_id_encrypted, env.APP_ENCRYPTION_KEY)
    : null;

  return {
    dailyDigestEnabled: row.daily_digest_enabled,
    defaultMeetingDuration: row.default_meeting_duration,
    weekStartsOnMonday: row.week_starts_on_monday,
    refreshTokenTtlDays: row.refresh_token_ttl_days,
    accessTokenTtlSeconds: row.access_token_ttl_seconds,
    sessionCookieName: row.session_cookie_name,
    errorAlertsTelegramEnabled: Boolean(decryptedBotToken && decryptedChatId),
  };
};

const mapAccountSettings = async (accountId: number): Promise<AccountSettings> => {
  const row = await findAccountSettingsByAccountId(accountId);

  if (row) {
    return {
      timezone: row.timezone,
      locale: row.locale,
      dailyDigestEnabled: row.daily_digest_enabled,
      defaultMeetingDuration: row.slot_duration_min,
      weekStartsOnMonday: row.week_starts_on_monday,
    };
  }

  const legacy = await findAppSettingsByAccountId(accountId);
  if (legacy) {
    return {
      timezone: legacy.timezone,
      locale: legacy.locale,
      dailyDigestEnabled: legacy.daily_digest_enabled,
      defaultMeetingDuration: legacy.slot_duration_min,
      weekStartsOnMonday: legacy.week_starts_on_monday,
    };
  }

  return {
    timezone: 'UTC',
    locale: 'ru-RU',
    dailyDigestEnabled: true,
    defaultMeetingDuration: 30,
    weekStartsOnMonday: true,
  };
};

export const getSystemSettings = async (): Promise<SystemSettings> => mapSystemSettings();

export const updateSystemSettings = async (payload: unknown): Promise<SystemSettings | null> => {
  const parsed = systemSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const wantsEncryptedTelegramSettings = Boolean(
    parsed.data.errorAlertsTelegramBotToken?.trim() || parsed.data.errorAlertsTelegramChatId?.trim(),
  );
  if (wantsEncryptedTelegramSettings && !env.APP_ENCRYPTION_KEY.trim()) {
    return null;
  }

  await updateSystemSettingsRecord({
    dailyDigestEnabled: parsed.data.dailyDigestEnabled,
    defaultMeetingDuration: parsed.data.defaultMeetingDuration,
    weekStartsOnMonday: parsed.data.weekStartsOnMonday,
    refreshTokenTtlDays: parsed.data.refreshTokenTtlDays,
    accessTokenTtlSeconds: parsed.data.accessTokenTtlSeconds,
    sessionCookieName: parsed.data.sessionCookieName,
    errorAlertsTelegramBotTokenEncrypted: parsed.data.errorAlertsTelegramBotToken === undefined
      ? undefined
      : (!parsed.data.errorAlertsTelegramBotToken.trim()
        ? null
        : (env.APP_ENCRYPTION_KEY.trim()
          ? encryptText(parsed.data.errorAlertsTelegramBotToken.trim(), env.APP_ENCRYPTION_KEY)
          : null)),
    errorAlertsTelegramChatIdEncrypted: parsed.data.errorAlertsTelegramChatId === undefined
      ? undefined
      : (!parsed.data.errorAlertsTelegramChatId.trim()
        ? null
        : (env.APP_ENCRYPTION_KEY.trim()
          ? encryptText(parsed.data.errorAlertsTelegramChatId.trim(), env.APP_ENCRYPTION_KEY)
          : null)),
  });

  return mapSystemSettings();
};

export const getAccountSettings = async (actor: User): Promise<AccountSettings> => {
  return mapAccountSettings(actor.accountId);
};

export const updateAccountSettings = async (actor: User, payload: unknown): Promise<AccountSettings | null> => {
  const parsed = accountSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  await updateAccountSettingsByAccountId({
    accountId: actor.accountId,
    timezone: parsed.data.timezone,
    locale: parsed.data.locale,
    slotDurationMin: parsed.data.defaultMeetingDuration,
    dailyDigestEnabled: parsed.data.dailyDigestEnabled,
    weekStartsOnMonday: parsed.data.weekStartsOnMonday,
  });

  await updateAppSettingsByAccountId({
    accountId: actor.accountId,
    timezone: parsed.data.timezone,
    locale: parsed.data.locale,
    slotDurationMin: parsed.data.defaultMeetingDuration,
    dailyDigestEnabled: parsed.data.dailyDigestEnabled,
    weekStartsOnMonday: parsed.data.weekStartsOnMonday,
  });

  return mapAccountSettings(actor.accountId);
};

export const getUserSettings = async (actor: User): Promise<UserSettings> => {
  const numericUserId = Number(actor.id);
  if (!Number.isInteger(numericUserId)) {
    return {
      timezone: 'UTC',
      locale: 'ru-RU',
      firstName: '',
      lastName: '',
      phone: '',
      telegramUsername: '',
      uiThemeMode: 'light',
      uiPaletteVariantId: 'default',
      googleConnected: false,
      zoomConnected: false,
      telegramBotConnected: false,
      telegramBotName: null,
      telegramBotUsername: null,
    };
  }

  const [userSettings, user, integration, legacyIntegration] = await Promise.all([
    findUserSettingsByWebUserId(actor.accountId, numericUserId),
    findWebUserById(actor.accountId, numericUserId),
    findUserIntegrationByWebUserId(actor.accountId, numericUserId),
    findWebUserIntegrationByWebUserId(actor.accountId, numericUserId),
  ]);

  return {
    timezone: userSettings?.timezone ?? user?.timezone ?? 'UTC',
    locale: userSettings?.locale ?? user?.locale ?? 'ru-RU',
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    phone: user?.phone ?? '',
    telegramUsername: user?.telegram_username ?? '',
    uiThemeMode: userSettings?.ui_theme_mode ?? user?.ui_theme_mode ?? 'light',
    uiPaletteVariantId: userSettings?.ui_palette_variant_id ?? user?.ui_palette_variant_id ?? 'default',
    googleConnected: Boolean(integration?.google_api_key ?? legacyIntegration?.google_api_key),
    zoomConnected: Boolean(
      legacyIntegration?.zoom_access_token
      && legacyIntegration?.zoom_token_expires_at
      && new Date(legacyIntegration.zoom_token_expires_at).getTime() > Date.now(),
    ),
    telegramBotConnected: Boolean(integration?.telegram_bot_token ?? legacyIntegration?.telegram_bot_token),
    telegramBotName: integration?.telegram_bot_name ?? legacyIntegration?.telegram_bot_name ?? null,
    telegramBotUsername: integration?.telegram_bot_username ?? legacyIntegration?.telegram_bot_username ?? null,
  };
};

export const updateUserSettings = async (actor: User, payload: unknown): Promise<UserSettings | null> => {
  const parsed = userSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const numericUserId = Number(actor.id);
  if (!Number.isInteger(numericUserId)) {
    return null;
  }

  let telegramBotTokenPatch: string | null | undefined;
  let telegramBotUsernamePatch: string | null | undefined;
  let telegramBotNamePatch: string | null | undefined;

  if (parsed.data.telegramBotToken !== undefined) {
    const trimmedToken = parsed.data.telegramBotToken.trim();

    if (!trimmedToken) {
      telegramBotTokenPatch = null;
      telegramBotUsernamePatch = null;
      telegramBotNamePatch = null;
    } else {
      telegramBotTokenPatch = trimmedToken;
      const botInfo = await verifyTelegramBotToken(trimmedToken);
      telegramBotUsernamePatch = botInfo?.username ?? null;
      telegramBotNamePatch = botInfo?.name ?? null;
    }
  }

  await updateWebUserSettings({
    accountId: actor.accountId,
    id: numericUserId,
    timezone: parsed.data.timezone,
    locale: parsed.data.locale,
    uiThemeMode: parsed.data.uiThemeMode,
    uiPaletteVariantId: parsed.data.uiPaletteVariantId,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    telegramUsername: parsed.data.telegramUsername,
  });

  await updateUserSettingsByWebUserId({
    accountId: actor.accountId,
    webUserId: numericUserId,
    timezone: parsed.data.timezone,
    locale: parsed.data.locale,
    uiThemeMode: parsed.data.uiThemeMode,
    uiPaletteVariantId: parsed.data.uiPaletteVariantId,
  });

  await updateWebUserTelegramIntegration({
    accountId: actor.accountId,
    webUserId: numericUserId,
    telegramBotToken: telegramBotTokenPatch,
    telegramBotUsername: telegramBotUsernamePatch,
    telegramBotName: telegramBotNamePatch,
  });

  await updateUserTelegramIntegration({
    accountId: actor.accountId,
    webUserId: numericUserId,
    telegramBotToken: telegramBotTokenPatch,
    telegramBotUsername: telegramBotUsernamePatch,
    telegramBotName: telegramBotNamePatch,
  });

  return getUserSettings(actor);
};

async function resolveSpecialistIdForPolicy(actor: User, specialistId?: number): Promise<number | null> {
  if (actor.role === WebUserRole.Owner || actor.role === WebUserRole.Admin) {
    if (!specialistId || !Number.isInteger(specialistId)) {
      return null;
    }

    const specialist = await findSpecialistById(actor.accountId, specialistId);
    return specialist ? specialist.id : null;
  }

  if (actor.role === WebUserRole.Specialist) {
    const own = await findSpecialistByWebUserId(actor.accountId, Number(actor.id));
    return own?.id ?? null;
  }

  return null;
}

export function canManageSpecialistBookingPolicies(role: User['role']): boolean {
  return role === WebUserRole.Owner || role === WebUserRole.Admin || role === WebUserRole.Specialist;
}

export async function getSpecialistBookingPolicy(
  actor: User,
  specialistId?: number,
): Promise<SpecialistBookingPolicy | null> {
  const resolvedSpecialistId = await resolveSpecialistIdForPolicy(actor, specialistId);
  if (!resolvedSpecialistId) {
    return null;
  }

  const row = await findSpecialistBookingPolicy(actor.accountId, resolvedSpecialistId);
  return {
    specialistId: resolvedSpecialistId,
    cancelGracePeriodHours: row?.cancel_grace_period_hours ?? 24,
    refundOnLateCancel: row?.refund_on_late_cancel ?? false,
    autoCancelUnpaidEnabled: row?.auto_cancel_unpaid_enabled ?? false,
    unpaidAutoCancelAfterHours: row?.unpaid_auto_cancel_after_hours ?? 72,
    meetingProvidersPriority: row?.meeting_providers_priority ?? 'zoom,manual',
    allowedMeetingProviders: row?.allowed_meeting_providers ?? 'zoom,manual',
    meetingProviderOverrideEnabled: row?.meeting_provider_override_enabled ?? false,
  };
}

export async function updateSpecialistBookingPolicy(
  actor: User,
  specialistId: number | undefined,
  payload: unknown,
): Promise<SpecialistBookingPolicy | null> {
  const parsed = specialistBookingPolicySchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const resolvedSpecialistId = await resolveSpecialistIdForPolicy(actor, specialistId);
  if (!resolvedSpecialistId) {
    return null;
  }

  await upsertSpecialistBookingPolicy({
    accountId: actor.accountId,
    specialistId: resolvedSpecialistId,
    cancelGracePeriodHours: parsed.data.cancelGracePeriodHours,
    refundOnLateCancel: parsed.data.refundOnLateCancel,
    autoCancelUnpaidEnabled: parsed.data.autoCancelUnpaidEnabled,
    unpaidAutoCancelAfterHours: parsed.data.unpaidAutoCancelAfterHours,
    meetingProvidersPriority: parsed.data.meetingProvidersPriority,
    allowedMeetingProviders: parsed.data.allowedMeetingProviders,
    meetingProviderOverrideEnabled: parsed.data.meetingProviderOverrideEnabled,
  });

  return getSpecialistBookingPolicy(actor, resolvedSpecialistId);
}

export async function getAccountNotificationDefaults(actor: User) {
  return getAccountNotificationDefaultsCore(actor.accountId);
}

export async function putAccountNotificationDefaults(actor: User, payload: unknown) {
  return putAccountNotificationDefaultsCore(actor.accountId, payload);
}

async function resolveSpecialistIdForNotifications(actor: User, specialistId?: number): Promise<number | null> {
  if (actor.role === WebUserRole.Owner || actor.role === WebUserRole.Admin) {
    if (!specialistId || !Number.isInteger(specialistId)) {
      return null;
    }

    const specialist = await findSpecialistById(actor.accountId, specialistId);
    return specialist?.id ?? null;
  }

  if (actor.role === WebUserRole.Specialist) {
    const own = await findSpecialistByWebUserId(actor.accountId, Number(actor.id));
    return own?.id ?? null;
  }

  return null;
}

async function resolveClientIdForNotifications(actor: User, clientId?: number): Promise<number | null> {
  if (actor.role === WebUserRole.Owner || actor.role === WebUserRole.Admin || actor.role === WebUserRole.Specialist) {
    if (!clientId || !Number.isInteger(clientId)) {
      return null;
    }

    const client = await findClientById(actor.accountId, clientId);
    return client?.id ?? null;
  }

  if (actor.role === WebUserRole.Client) {
    const own = await findWebUserById(actor.accountId, Number(actor.id));
    return own?.client_id ?? null;
  }

  return null;
}

export async function getSpecialistNotificationSettings(actor: User, specialistId?: number) {
  const resolvedSpecialistId = await resolveSpecialistIdForNotifications(actor, specialistId);
  if (!resolvedSpecialistId) {
    return null;
  }

  return getSpecialistNotificationSettingsCore(actor.accountId, resolvedSpecialistId);
}

export async function putSpecialistNotificationSettings(actor: User, specialistId: number | undefined, payload: unknown) {
  const resolvedSpecialistId = await resolveSpecialistIdForNotifications(actor, specialistId);
  if (!resolvedSpecialistId) {
    return null;
  }

  return putSpecialistNotificationSettingsCore(actor.accountId, resolvedSpecialistId, payload);
}

export async function getClientNotificationSettings(actor: User, clientId?: number) {
  const resolvedClientId = await resolveClientIdForNotifications(actor, clientId);
  if (!resolvedClientId) {
    return null;
  }

  return getClientNotificationSettingsCore(actor.accountId, resolvedClientId);
}

export async function putClientNotificationSettings(actor: User, clientId: number | undefined, payload: unknown) {
  const resolvedClientId = await resolveClientIdForNotifications(actor, clientId);
  if (!resolvedClientId) {
    return null;
  }

  return putClientNotificationSettingsCore(actor.accountId, resolvedClientId, payload);
}

export async function getEffectiveNotificationSetting(
  actor: User,
  notificationType: 'appointment_created' | 'appointment_reminder' | 'payment_reminder',
  specialistId?: number,
  clientId?: number,
) {
  const resolvedSpecialistId = await resolveSpecialistIdForNotifications(actor, specialistId);
  const resolvedClientId = await resolveClientIdForNotifications(actor, clientId);

  if (!resolvedSpecialistId || !resolvedClientId) {
    return null;
  }

  return getEffectiveNotificationSettingCore({
    accountId: actor.accountId,
    specialistId: resolvedSpecialistId,
    clientId: resolvedClientId,
    notificationType,
  });
}
