export type AuthResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
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


export type GoogleOAuthStartResponse = {
  provider: 'google';
  authorizeUrl: string;
  state: string;
};
