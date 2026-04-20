export type User = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

export type AppSettings = {
  timezone: string;
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
  locale: string;
  googleConnected: boolean;
  uiThemeMode: 'light' | 'dark';
  uiPaletteVariantId: string;
};

export type Session = {
  userId: string;
  expiresAt: number;
};
