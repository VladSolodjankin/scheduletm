import { db } from '../db/knex.js';

export type SystemSettingsRecord = {
  id: number;
  daily_digest_enabled: boolean;
  default_meeting_duration: number;
  week_starts_on_monday: boolean;
  refresh_token_ttl_days: number;
  access_token_ttl_seconds: number;
  session_cookie_name: string;
  google_oauth_client_id: string | null;
  google_oauth_client_secret: string | null;
  google_oauth_redirect_uri: string | null;
};

export type UpdateSystemSettingsInput = {
  dailyDigestEnabled?: boolean;
  defaultMeetingDuration?: number;
  weekStartsOnMonday?: boolean;
  refreshTokenTtlDays?: number;
  accessTokenTtlSeconds?: number;
  sessionCookieName?: string;
  googleOauthClientId?: string;
  googleOauthClientSecret?: string;
  googleOauthRedirectUri?: string;
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

  if (input.googleOauthClientId !== undefined) {
    patch.google_oauth_client_id = input.googleOauthClientId;
  }

  if (input.googleOauthClientSecret !== undefined) {
    patch.google_oauth_client_secret = input.googleOauthClientSecret;
  }

  if (input.googleOauthRedirectUri !== undefined) {
    patch.google_oauth_redirect_uri = input.googleOauthRedirectUri;
  }

  await db('system_settings').whereIn('id', db('system_settings').select('id').orderBy('id', 'asc').limit(1)).update(patch);
}
