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
import type { User } from '../types/domain.js';
import { accountSettingsSchema, systemSettingsSchema, userSettingsSchema } from '../config/schemas.js';
import { verifyTelegramBotToken } from './telegramService.js';
import { canManageAccountSettings, canManageSystemSettings } from '../policies/rolePermissions.js';
export { canManageAccountSettings, canManageSystemSettings } from '../policies/rolePermissions.js';

export type SystemSettings = {
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
  refreshTokenTtlDays: number;
  accessTokenTtlSeconds: number;
  sessionCookieName: string;
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
  uiThemeMode: 'light' | 'dark';
  uiPaletteVariantId: string;
  googleConnected: boolean;
  telegramBotConnected: boolean;
  telegramBotName: string | null;
  telegramBotUsername: string | null;
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  refreshTokenTtlDays: 30,
  accessTokenTtlSeconds: 900,
  sessionCookieName: 'meetli_refresh_token',
};

const mapSystemSettings = async (): Promise<SystemSettings> => {
  const row = await getSystemSettingsRecord();
  if (!row) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  return {
    dailyDigestEnabled: row.daily_digest_enabled,
    defaultMeetingDuration: row.default_meeting_duration,
    weekStartsOnMonday: row.week_starts_on_monday,
    refreshTokenTtlDays: row.refresh_token_ttl_days,
    accessTokenTtlSeconds: row.access_token_ttl_seconds,
    sessionCookieName: row.session_cookie_name,
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

  await updateSystemSettingsRecord({
    dailyDigestEnabled: parsed.data.dailyDigestEnabled,
    defaultMeetingDuration: parsed.data.defaultMeetingDuration,
    weekStartsOnMonday: parsed.data.weekStartsOnMonday,
    refreshTokenTtlDays: parsed.data.refreshTokenTtlDays,
    accessTokenTtlSeconds: parsed.data.accessTokenTtlSeconds,
    sessionCookieName: parsed.data.sessionCookieName,
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
      uiThemeMode: 'light',
      uiPaletteVariantId: 'default',
      googleConnected: false,
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
    uiThemeMode: userSettings?.ui_theme_mode ?? user?.ui_theme_mode ?? 'light',
    uiPaletteVariantId: userSettings?.ui_palette_variant_id ?? user?.ui_palette_variant_id ?? 'default',
    googleConnected: Boolean(integration?.google_api_key ?? legacyIntegration?.google_api_key),
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

