import type { AppSettings } from '../types/domain.js';
import { settingsSchema } from '../config/schemas.js';
import { defaultSettings, settingsByUserId } from '../repositories/inMemoryStore.js';

export const getSettings = (userId: string): AppSettings => {
  return settingsByUserId.get(userId) ?? { ...defaultSettings };
};

export const updateSettings = (userId: string, payload: unknown): AppSettings | null => {
  const parsed = settingsSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const next = { ...getSettings(userId), ...parsed.data };
  settingsByUserId.set(userId, next);
  return next;
};

export const markGoogleConnected = (userId: string) => {
  const next = { ...getSettings(userId), googleConnected: true };
  settingsByUserId.set(userId, next);
  return {
    status: 'connected',
    provider: 'google',
    connectedAt: new Date().toISOString(),
    oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
  };
};
