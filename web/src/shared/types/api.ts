import type { WebUserRole } from './roles';

export type AuthResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: WebUserRole;
    fullName?: string;
    avatarUrl?: string;
  };
};

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
};

export type GoogleOAuthStartResponse = {
  provider: 'google';
  authorizeUrl: string;
  state: string;
};

export type AppointmentStatus = 'new' | 'confirmed' | 'cancelled';

export type SpecialistItem = {
  id: number;
  name: string;
};

export type AppointmentItem = {
  id: number;
  specialistId: number;
  scheduledAt: string;
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
};

export type AppointmentListResponse = {
  appointments: AppointmentItem[];
  specialists: SpecialistItem[];
  busySlots: Array<{
    specialistId: number;
    scheduledAt: string;
    durationMin: number;
    source: 'google';
  }>;
};
