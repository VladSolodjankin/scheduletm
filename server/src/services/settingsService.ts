import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { findAppSettingsByAccountId, updateAppSettingsByAccountId } from '../repositories/appSettingsRepository.js';
import { findWebUserById, updateWebUserSettings } from '../repositories/webUserRepository.js';
import { findWebUserIntegrationByWebUserId, updateWebUserTelegramIntegration } from '../repositories/webUserIntegrationRepository.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { systemSettingsSchema, userSettingsSchema } from '../config/schemas.js';
import { verifyTelegramBotToken } from './telegramService.js';

export type SystemSettings = {
  timezone: string;
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
  locale: string;
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
  timezone: 'UTC',
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  locale: 'ru-RU',
};

const mapSystemSettings = async (): Promise<SystemSettings> => {
  const accountId = await getDefaultAccountId();
  const row = await findAppSettingsByAccountId(accountId);

  if (!row) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  return {
    timezone: row.timezone,
    dailyDigestEnabled: row.daily_digest_enabled,
    defaultMeetingDuration: row.slot_duration_min,
    weekStartsOnMonday: row.week_starts_on_monday,
    locale: row.locale,
  };
};

export const canManageSystemSettings = (role: WebUserRole): boolean => {
  return role === WebUserRole.Owner || role === WebUserRole.Admin;
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  return mapSystemSettings();
};

export const updateSystemSettings = async (payload: unknown): Promise<SystemSettings | null> => {
  const parsed = systemSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const accountId = await getDefaultAccountId();
  await updateAppSettingsByAccountId({
    accountId,
    timezone: parsed.data.timezone,
    slotDurationMin: parsed.data.defaultMeetingDuration,
    dailyDigestEnabled: parsed.data.dailyDigestEnabled,
    weekStartsOnMonday: parsed.data.weekStartsOnMonday,
    locale: parsed.data.locale,
  });

  return mapSystemSettings();
};

export const getUserSettings = async (userId: string): Promise<UserSettings> => {
  const accountId = await getDefaultAccountId();
  const numericUserId = Number(userId);
  const user = Number.isInteger(numericUserId)
    ? await findWebUserById(accountId, numericUserId)
    : null;

  if (!user) {
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

  const integration = await findWebUserIntegrationByWebUserId(accountId, numericUserId);

  return {
    timezone: user.timezone,
    locale: user.locale,
    uiThemeMode: user.ui_theme_mode,
    uiPaletteVariantId: user.ui_palette_variant_id,
    googleConnected: Boolean(integration?.google_api_key),
    telegramBotConnected: Boolean(integration?.telegram_bot_token),
    telegramBotName: integration?.telegram_bot_name ?? null,
    telegramBotUsername: integration?.telegram_bot_username ?? null,
  };
};

export const updateUserSettings = async (actor: User, payload: unknown): Promise<UserSettings | null> => {
  const parsed = userSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const accountId = await getDefaultAccountId();
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
    accountId,
    id: numericUserId,
    timezone: parsed.data.timezone,
    locale: parsed.data.locale,
    uiThemeMode: parsed.data.uiThemeMode,
    uiPaletteVariantId: parsed.data.uiPaletteVariantId,
  });

  await updateWebUserTelegramIntegration({
    accountId,
    webUserId: numericUserId,
    telegramBotToken: telegramBotTokenPatch,
    telegramBotUsername: telegramBotUsernamePatch,
    telegramBotName: telegramBotNamePatch,
  });

  return getUserSettings(actor.id);
};
