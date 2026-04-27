import { db } from '../db/knex.js';

export type SystemSettingsRecord = {
  id: number;
  daily_digest_enabled: boolean;
  default_meeting_duration: number;
  week_starts_on_monday: boolean;
  refresh_token_ttl_days: number;
  access_token_ttl_seconds: number;
  session_cookie_name: string;
  error_alerts_telegram_bot_token_encrypted: string | null;
  error_alerts_telegram_chat_id_encrypted: string | null;
};

export type UpdateSystemSettingsInput = {
  dailyDigestEnabled?: boolean;
  defaultMeetingDuration?: number;
  weekStartsOnMonday?: boolean;
  refreshTokenTtlDays?: number;
  accessTokenTtlSeconds?: number;
  sessionCookieName?: string;
  errorAlertsTelegramBotTokenEncrypted?: string | null;
  errorAlertsTelegramChatIdEncrypted?: string | null;
};

export async function getSystemSettingsRecord(): Promise<SystemSettingsRecord | null> {
  const row = await db('system_settings').orderBy('id', 'asc').first<SystemSettingsRecord>();
  return row ?? null;
}

export async function updateSystemSettingsRecord(input: UpdateSystemSettingsInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.dailyDigestEnabled !== undefined) {
    patch.daily_digest_enabled = input.dailyDigestEnabled;
  }

  if (input.defaultMeetingDuration !== undefined) {
    patch.default_meeting_duration = input.defaultMeetingDuration;
  }

  if (input.weekStartsOnMonday !== undefined) {
    patch.week_starts_on_monday = input.weekStartsOnMonday;
  }

  if (input.refreshTokenTtlDays !== undefined) {
    patch.refresh_token_ttl_days = input.refreshTokenTtlDays;
  }

  if (input.accessTokenTtlSeconds !== undefined) {
    patch.access_token_ttl_seconds = input.accessTokenTtlSeconds;
  }

  if (input.sessionCookieName !== undefined) {
    patch.session_cookie_name = input.sessionCookieName;
  }

  if (input.errorAlertsTelegramBotTokenEncrypted !== undefined) {
    patch.error_alerts_telegram_bot_token_encrypted = input.errorAlertsTelegramBotTokenEncrypted;
  }

  if (input.errorAlertsTelegramChatIdEncrypted !== undefined) {
    patch.error_alerts_telegram_chat_id_encrypted = input.errorAlertsTelegramChatIdEncrypted;
  }


  await db('system_settings').whereIn('id', db('system_settings').select('id').orderBy('id', 'asc').limit(1)).update(patch);
}
