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
};
