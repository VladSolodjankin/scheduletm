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

export type GoogleOAuthDisconnectResponse = {
  provider: 'google';
  connected: boolean;
};

export type AppointmentStatus = 'new' | 'confirmed' | 'cancelled';

export type SpecialistItem = {
  id: number;
  name: string;
  timezone: string;
  slotStepMin: number;
};

export type AppointmentItem = {
  id: number;
  specialistId: number;
  scheduledAt: string;
  durationMin: number;
  status: AppointmentStatus;
  paymentStatus: 'paid' | 'unpaid';
  meetingLink: string;
  notes: string;
  client: ClientItem;
  events: Array<{
    action: 'cancel' | 'reschedule' | 'mark-paid' | 'notify';
    createdAt: string;
  }>;
};

export type ClientItem = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

export type AppointmentListResponse = {
  appointments: AppointmentItem[];
  specialists: SpecialistItem[];
  clients: ClientItem[];
  busySlots: Array<{
    specialistId: number;
    scheduledAt: string;
    durationMin: number;
    source: 'google';
    title: string;
    organizerEmail: string;
    creatorEmail: string;
  }>;
};
