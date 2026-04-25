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

export type RegisterResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    role: WebUserRole;
  };
};


export type InviteVerifyResponse = {
  message: string;
  invite: {
    email: string;
    accountName: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

export type VerifyEmailResponse = {
  message: string;
};

export type SystemSettings = {
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
  refreshTokenTtlDays: number;
  accessTokenTtlSeconds: number;
  sessionCookieName: string;
};

export type AccountSettings = {
  timezone: string;
  locale: string;
  dailyDigestEnabled: boolean;
  defaultMeetingDuration: number;
  weekStartsOnMonday: boolean;
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
  telegramBotToken?: string;
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


export type SpecialistManagementItem = {
  id: number;
  name: string;
  code: string;
  timezone: string;
  isActive: boolean;
  slotStepMin: number;
};

export type SpecialistsListResponse = {
  specialists: SpecialistManagementItem[];
  availableWebUsers: Array<{
    id: number;
    email: string;
  }>;
};


export type ManagedUserItem = {
  id: number;
  email: string;
  role: WebUserRole;
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
};

export type ManagedUsersListResponse = {
  users: ManagedUserItem[];
};
