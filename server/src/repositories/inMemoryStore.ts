import type { AppSettings, Session, User } from '../types/domain.js';

export const usersByEmail = new Map<string, User>();
export const settingsByUserId = new Map<string, AppSettings>();
export const refreshSessions = new Map<string, Session>();
export const accessSessions = new Map<string, Session>();
export const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
export const oauthStateByToken = new Map<string, { userId: string; createdAt: number }>();

export const defaultSettings: AppSettings = {
  timezone: 'UTC',
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  locale: 'ru-RU',
  googleConnected: false,
  uiThemeMode: 'light',
  uiPaletteVariantId: 'default'
};
