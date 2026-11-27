import { z } from 'zod';
import { schemaValidationDictionary as v } from '../i18n/dictionaries.js';

function isValidIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z
  .string()
  .min(1, v.timezoneRequired)
  .max(64, v.timezoneTooLong)
  .refine(isValidIanaTimezone, v.timezoneInvalid);

export const passwordSchema = z
  .string()
  .min(10, v.passwordMinLength)
  .max(128, v.passwordMaxLength)
  .regex(/[A-Z]/, v.passwordNeedUppercase)
  .regex(/[a-z]/, v.passwordNeedLowercase)
  .regex(/[0-9]/, v.passwordNeedDigit);

export const registrationSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
  firstName: z.string().trim().min(1, v.managedUserFirstNameRequired).max(120, v.managedUserFirstNameTooLong),
  lastName: z.string().trim().min(1, v.managedUserLastNameRequired).max(120, v.managedUserLastNameTooLong),
  phone: z.string().trim().min(1, v.registrationPhoneRequired).max(50, v.managedUserPhoneTooLong),
  telegramUsername: z.string().trim().max(255, v.managedUserTelegramTooLong).optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  password: z.string().min(1, v.loginPasswordRequired),
  timezone: timezoneSchema.optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email(v.emailInvalid).max(254, v.emailTooLong),
});

export const passwordResetConfirmSchema = z.object({
  email: z.string().trim().email(v.emailInvalid).max(254, v.emailTooLong),
  code: z.string().trim().regex(/^\d{4}$/, v.passwordResetCodeInvalid),
  password: passwordSchema,
});

export const emailChangeRequestSchema = z.object({
  newEmail: z.string().trim().email(v.emailInvalid).max(254, v.emailTooLong),
  password: z.string().min(1, v.loginPasswordRequired),
});

export const emailChangeConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{4}$/, v.passwordResetCodeInvalid),
});

export const verifyEmailSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  code: z
    .string()
    .trim()
    .regex(/^\d{4}$/, v.emailVerificationCodeInvalid),
});


export const verifyInviteSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  token: z
    .string()
    .trim()
    .min(8, v.emailVerificationCodeInvalid)
    .max(128, v.emailVerificationCodeInvalid),
});

export const acceptInviteSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  token: z
    .string()
    .trim()
    .min(8, v.emailVerificationCodeInvalid)
    .max(128, v.emailVerificationCodeInvalid),
  password: passwordSchema,
  firstName: z.string().trim().min(1, v.managedUserFirstNameRequired).max(120, v.managedUserFirstNameTooLong),
  lastName: z.string().trim().min(1, v.managedUserLastNameRequired).max(120, v.managedUserLastNameTooLong),
  telegramUsername: z.string().trim().max(255, v.managedUserTelegramTooLong).optional().or(z.literal('')),
});

export const resendEmailVerificationCodeSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
});

export const systemSettingsSchema = z.object({
  dailyDigestEnabled: z.boolean(),
  defaultMeetingDuration: z.coerce
    .number()
    .int(v.meetingDurationMustBeInteger)
    .min(15, v.meetingDurationMin)
    .max(180, v.meetingDurationMax),
  weekStartsOnMonday: z.boolean(),
  refreshTokenTtlDays: z.coerce.number().int().min(1).max(365),
  accessTokenTtlSeconds: z.coerce.number().int().min(60).max(86400),
  sessionCookieName: z.string().trim().min(1).max(128),
  errorAlertsTelegramBotToken: z.string().trim().max(512).optional().or(z.literal('')),
  errorAlertsTelegramChatId: z.string().trim().max(255).optional().or(z.literal('')),
}).partial();

export const accountSettingsSchema = z.object({
  defaultMeetingDuration: z.coerce
    .number()
    .int(v.meetingDurationMustBeInteger)
    .min(15, v.meetingDurationMin)
    .max(180, v.meetingDurationMax)
    .describe('Default appointment length in minutes'),
  dailyDigestEnabled: z.boolean().describe('Send the daily email digest of upcoming appointments'),
  weekStartsOnMonday: z.boolean().describe('Calendars start the week on Monday instead of Sunday'),
  businessAddress: z.string().trim().max(512).describe('Address where clients come for offline appointments'),
  businessLat: z.coerce.number().min(-90).max(90).nullable().describe('Latitude of the business address'),
  businessLng: z.coerce.number().min(-180).max(180).nullable().describe('Longitude of the business address'),
  specialistsSeeAllAppointments: z.boolean().describe('Specialists see every appointment of the account, not only their own'),
  workDays: z.array(z.number().int().min(1).max(7)).min(1).max(7)
    .refine((days) => new Set(days).size === days.length, { message: v.workDaysUnique })
    .describe('Weekdays clients can book: ISO numbers, 1 is Monday and 7 is Sunday'),
}).partial();

export const BOT_SLUG_PATTERN = /^[a-z0-9_-]{3,40}$/;
export const BOT_WELCOME_MESSAGE_MAX_LENGTH = 500;

export const telegramBotSettingsSchema = z.object({
  enabled: z.boolean(),
  slug: z.string().trim().toLowerCase().regex(BOT_SLUG_PATTERN),
  welcomeMessage: z.string().max(BOT_WELCOME_MESSAGE_MAX_LENGTH),
  // Non-empty connects the account's own bot, an empty string disconnects it.
  customBotToken: z.string().trim().max(255, v.telegramBotTokenTooLong),
}).partial();

export const userSettingsSchema = z.object({
  timezone: timezoneSchema,
  locale: z.string().min(2, v.localeRequired).max(16, v.localeTooLong),
  firstName: z.string().trim().min(1, v.managedUserFirstNameRequired).max(120, v.managedUserFirstNameTooLong),
  lastName: z.string().trim().min(1, v.managedUserLastNameRequired).max(120, v.managedUserLastNameTooLong),
  phone: z.string().trim().max(50, v.managedUserPhoneTooLong).optional().or(z.literal('')),
  telegramUsername: z.string().trim().max(255, v.managedUserTelegramTooLong).optional().or(z.literal('')),
  uiThemeMode: z.enum(['light', 'dark']),
  uiPaletteVariantId: z.string().min(1, v.paletteIdRequired).max(64, v.paletteIdTooLong),
}).partial();

export const specialistBookingPolicySchema = z.object({
  cancelGracePeriodHours: z.coerce.number().int().min(0).max(336)
    .describe('Clients can cancel free of charge until this many hours before the appointment'),
  refundOnLateCancel: z.boolean().describe('Refund the payment when a client cancels later than the grace period'),
  autoCancelUnpaidEnabled: z.boolean().describe('Cancel appointments that stay unpaid automatically'),
  unpaidAutoCancelAfterHours: z.coerce.number().int().min(1).max(720)
    .describe('Hours after booking after which an unpaid appointment is cancelled'),
  allowedMeetingProviders: z.string().trim().min(1).max(120)
    .describe('Comma-separated meeting formats clients can choose: offline, zoom, yandex_telemost, manual'),
  meetingProviderOverrideEnabled: z.boolean().describe('Let the specialist change the meeting format of a single appointment'),
}).partial();

const WHOLE_DAY_EXCEPTION_TYPES = new Set(['day_off', 'vacation']);
const PARTIAL_DAY_EXCEPTION_TYPES = new Set(['interval', 'break']);

export const scheduleExceptionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v.scheduleExceptionDateInvalid).describe('Date, YYYY-MM-DD'),
  type: z.enum(['day_off', 'vacation', 'interval', 'break'])
    .describe('day_off and vacation block the whole day; interval and break block the time between startsAtMinute and endsAtMinute'),
  startsAtMinute: z.coerce.number().int().min(0).max(1439).optional()
    .describe('Start of a blocked interval in minutes from midnight, e.g. 780 for 13:00. Only for interval and break'),
  endsAtMinute: z.coerce.number().int().min(1).max(1440).optional()
    .describe('End of a blocked interval in minutes from midnight. Only for interval and break'),
  note: z.string().trim().max(200).optional().describe('Short note, e.g. a holiday name'),
}).refine((value) => (value.startsAtMinute === undefined) === (value.endsAtMinute === undefined), {
  message: v.scheduleExceptionIntervalRequired,
}).refine((value) => (
  !WHOLE_DAY_EXCEPTION_TYPES.has(value.type) || value.startsAtMinute === undefined
), {
  message: v.scheduleExceptionWholeDayNoInterval,
}).refine((value) => (
  !PARTIAL_DAY_EXCEPTION_TYPES.has(value.type) || value.startsAtMinute !== undefined
), {
  message: v.scheduleExceptionIntervalRequired,
}).refine((value) => (
  value.startsAtMinute === undefined || value.endsAtMinute === undefined || value.startsAtMinute < value.endsAtMinute
), {
  message: v.scheduleExceptionEndAfterStart,
});

const notificationTypeSchema = z.enum(['appointment_created', 'appointment_reminder', 'payment_reminder']);
const notificationChannelSchema = z.enum(['email', 'telegram', 'viber', 'whatsapp', 'sms']);
const notificationFrequencySchema = z.enum(['immediate', 'daily']);

export const specialistNotificationSettingsPatchSchema = z.object({
  notificationType: notificationTypeSchema.describe(
    'appointment_created: confirmation right after booking; appointment_reminder: reminder before the visit; payment_reminder: reminder to pay',
  ),
  preferredChannel: notificationChannelSchema.describe('Channel used to deliver the notification'),
  enabled: z.boolean().describe('Whether this notification is sent'),
  sendTimings: z.array(z.string().trim().min(1)).max(16)
    .describe('When to send: "immediate", or hours before the appointment such as "24h", "2h", "1h"'),
  frequency: notificationFrequencySchema.describe('immediate: one message per event; daily: grouped into one daily message'),
});

export const specialistNotificationSettingsBatchSchema = z.object({
  items: z.array(specialistNotificationSettingsPatchSchema).max(64),
});

export const accountNotificationDefaultsBatchSchema = z.object({
  items: z.array(specialistNotificationSettingsPatchSchema).max(128),
});

export const clientNotificationSettingsPatchSchema = z.object({
  notificationType: notificationTypeSchema,
  channel: notificationChannelSchema,
  enabled: z.boolean(),
});

export const clientNotificationSettingsBatchSchema = z.object({
  items: z.array(clientNotificationSettingsPatchSchema).max(64),
});

export const specialistUserCreationSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  password: passwordSchema,
  specialistName: z
    .string()
    .min(2, v.specialistNameMin)
    .max(120, v.specialistNameMax)
});

const managedUserRoleSchema = z.enum(['specialist', 'client']);

export const managedUserCreateSchema = z.object({
  email: z.string().trim().email(v.emailInvalid).max(254, v.emailTooLong),
  role: managedUserRoleSchema,
  firstName: z.string().trim().min(1, v.managedUserFirstNameRequired).max(120, v.managedUserFirstNameTooLong),
  lastName: z.string().trim().min(1, v.managedUserLastNameRequired).max(120, v.managedUserLastNameTooLong),
  phone: z.string().trim().max(50, v.managedUserPhoneTooLong).optional().or(z.literal('')),
  telegramUsername: z.string().trim().max(255, v.managedUserTelegramTooLong).optional().or(z.literal('')),
});

export const managedUserUpdateSchema = managedUserCreateSchema;

export const specialistCreateSchema = z.object({
  userId: z.coerce.number().int().positive(v.specialistUserIdRequired),
});

export const specialistUpdateSchema = z.object({
  name: z.string().trim().min(2, v.specialistNameMin).max(120, v.specialistNameMax).optional()
    .describe('Name shown to clients'),
  isActive: z.boolean().optional().describe('Inactive specialists cannot be booked'),
  baseSessionPrice: z.coerce.number().int().min(0).max(10_000_000).optional()
    .describe('Default price of one session in whole currency units, e.g. 1500'),
  baseHourPrice: z.coerce.number().int().min(0).max(10_000_000).optional()
    .describe('Default price of one hour in whole currency units, e.g. 1500'),
  workStartHour: z.coerce.number().int().min(0).max(23).optional().describe('Working day starts at this hour (0-23)'),
  workEndHour: z.coerce.number().int().min(1).max(24).optional().describe('Working day ends at this hour (1-24)'),
  slotDurationMin: z.coerce.number().int().min(15).max(480).optional().describe('Length of a bookable slot in minutes'),
  slotStepMin: z.coerce.number().int().min(5).max(240).optional().describe('Minutes between possible slot start times'),
  defaultSessionContinuationMin: z.coerce.number().int().min(15).max(480).optional()
    .describe('Minutes added when a session is extended'),
}).refine((value) => Object.keys(value).length > 0, {
  message: v.atLeastOneFieldToUpdate,
}).refine((value) => (
  value.workStartHour === undefined || value.workEndHour === undefined || value.workStartHour < value.workEndHour
), {
  path: ['workEndHour'],
  message: v.workEndAfterStart,
});

const specialistIdsSchema = z.array(z.coerce.number().int().positive()).max(500);

const servicePayloadSchema = z.object({
  name: z.string().trim().min(1).max(255).describe('Service name shown to clients'),
  description: z.string().trim().max(5000).nullable().optional().describe('What the client gets'),
  basePrice: z.coerce.number().int().min(0).max(10_000_000).describe('Price in whole currency units, e.g. 1500'),
  baseDurationMinutes: z.coerce.number().int().min(5).max(1440).describe('Duration in minutes'),
  firstSessionFree: z.boolean().optional().describe('The first session of a new client is free'),
  imageMediaId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().describe('Inactive services cannot be booked'),
  specialistIds: specialistIdsSchema.optional().describe('Specialists who provide this service'),
}).strict();

export const serviceCreateSchema = servicePayloadSchema;

export const serviceUpdateSchema = servicePayloadSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: v.atLeastOneFieldToUpdate,
  });

export const serviceAssignmentUpdateSchema = z.object({
  priceOverride: z.coerce.number().int().min(0).max(10_000_000).nullable().optional()
    .describe('This specialist\'s own price in whole currency units, e.g. 1500; null uses the service price'),
  durationOverrideMinutes: z.coerce.number().int().min(5).max(1440).nullable().optional()
    .describe('This specialist\'s own duration in minutes; null uses the service duration'),
  isActive: z.boolean().optional().describe('Whether this specialist currently provides the service'),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: v.atLeastOneFieldToUpdate,
});

const appointmentStatusSchema = z.enum(['new', 'confirmed', 'cancelled']);
const appointmentMeetingProviderSchema = z.enum(['manual', 'zoom', 'yandex_telemost', 'offline']);

const appointmentClientSchema = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  username: z.string().trim().max(255).optional(),
  firstName: z.string().trim().min(1, v.appointmentFirstNameRequired).max(255).optional(),
  lastName: z.string().trim().min(1, v.appointmentLastNameRequired).max(255).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email(v.emailInvalid).max(254).optional(),
});

export const appointmentCreateSchema = z.object({
  specialistId: z.coerce.number().int().positive(v.appointmentSpecialistRequired),
  appointmentAt: z.string().datetime(v.appointmentStartInvalid),
  appointmentEndAt: z.string().datetime(v.appointmentEndInvalid),
  status: appointmentStatusSchema.optional(),
  meetingLink: z.string().trim().url(v.appointmentLinkInvalid).max(2048).optional().or(z.literal('')),
  locationAddress: z.string().trim().max(500).optional(),
  meetingProvider: appointmentMeetingProviderSchema.optional(),
  saveClientMeetingPreference: z.boolean().optional(),
  notes: z.string().trim().max(2000, v.appointmentNotesTooLong).optional(),
  recurrence: z.object({
    frequency: z.enum(['daily', 'weekly']),
    occurrences: z.coerce.number().int().min(2).max(52),
  }).strict().optional(),
}).merge(appointmentClientSchema).superRefine((value, ctx) => {
  if (!value.firstName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstName'], message: v.appointmentFirstNameRequired });
  }

  if (!value.lastName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'], message: v.appointmentLastNameRequired });
  }

  if (!value.username && !value.phone && !value.email && !value.clientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['username'],
      message: v.appointmentContactRequired,
    });
  }

  const start = new Date(value.appointmentAt).getTime();
  const end = new Date(value.appointmentEndAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentEndAt'],
      message: v.appointmentEndMustBeAfterStart,
    });
    return;
  }

  const durationMin = Math.round((end - start) / 60_000);
  if (durationMin < 15 || durationMin > 480) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentEndAt'],
      message: v.appointmentDurationRange,
    });
  }
});

export const appointmentUpdateSchema = z.object({
  appointmentAt: z.string().datetime(v.appointmentStartInvalid).optional(),
  appointmentEndAt: z.string().datetime(v.appointmentEndInvalid).optional(),
  durationMin: z.coerce.number().int().min(15, v.appointmentDurationMin).max(480, v.appointmentDurationMax).optional(),
  status: appointmentStatusSchema.optional(),
  meetingLink: z.string().trim().url(v.appointmentLinkInvalid).max(2048).optional().or(z.literal('')),
  locationAddress: z.string().trim().max(500).optional(),
  meetingProvider: appointmentMeetingProviderSchema.optional(),
  notes: z.string().trim().max(2000, v.appointmentNotesTooLong).optional(),
}).merge(appointmentClientSchema).superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: v.atLeastOneFieldToUpdate });
    return;
  }

  if ((value.appointmentAt && !value.appointmentEndAt) || (!value.appointmentAt && value.appointmentEndAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentEndAt'],
      message: v.appointmentStartAndEndRequired,
    });
    return;
  }

  if (value.appointmentAt && value.appointmentEndAt) {
    const start = new Date(value.appointmentAt).getTime();
    const end = new Date(value.appointmentEndAt).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['appointmentEndAt'],
        message: v.appointmentEndMustBeAfterStart,
      });
      return;
    }

    const durationMin = Math.round((end - start) / 60_000);
    if (durationMin < 15 || durationMin > 480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['appointmentEndAt'],
        message: v.appointmentDurationRange,
      });
    }
  }
}).refine((value) => Object.keys(value).length > 0, {
  message: v.atLeastOneFieldToUpdate,
});

export const appointmentRescheduleSchema = z.object({
  scheduledAt: z.string().datetime(v.appointmentRescheduleInvalid),
});

const reviewFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(1500),
  rating: z.number().int().min(1).max(5),
  reviewDate: z.string().trim().max(40),
  screenshotMediaId: z.string().uuid().nullable(),
  screenshotAlt: z.string().trim().max(200),
  status: z.enum(['published', 'hidden']),
}).strict();

export const reviewCreateSchema = reviewFieldsSchema
  .partial({ screenshotMediaId: true, screenshotAlt: true, reviewDate: true, status: true })
  .extend({
    reviewDate: reviewFieldsSchema.shape.reviewDate.default(''),
    status: reviewFieldsSchema.shape.status.default('published'),
  })
  .refine((value) => !value.screenshotMediaId || Boolean(value.screenshotAlt), {
    path: ['screenshotAlt'],
    message: 'Screenshot alt is required',
  });

export const reviewUpdateSchema = reviewFieldsSchema.partial()
  .refine((value) => Object.keys(value).length > 0, { message: v.atLeastOneFieldToUpdate });

// ---- Payment setup ----

const httpsUrlSchema = z.string().trim().max(500, v.paymentFieldTooLong).refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, v.paymentUrlInvalid);

export const paymentManualSettingsSchema = z.object({
  bankTransfer: z.object({
    enabled: z.boolean(),
    text: z.string().trim().max(1000, v.paymentFieldTooLong),
  }),
  customLink: z.object({
    enabled: z.boolean(),
    title: z.string().trim().max(60, v.paymentFieldTooLong),
    url: z.union([z.literal(''), httpsUrlSchema]),
  }),
  cash: z.object({
    enabled: z.boolean(),
    comment: z.string().trim().max(500, v.paymentFieldTooLong),
  }),
}).superRefine((value, ctx) => {
  if (value.bankTransfer.enabled && !value.bankTransfer.text) {
    ctx.addIssue({ code: 'custom', path: ['bankTransfer', 'text'], message: v.paymentTextRequired });
  }
  if (value.customLink.enabled && !value.customLink.title) {
    ctx.addIssue({ code: 'custom', path: ['customLink', 'title'], message: v.paymentTextRequired });
  }
  if (value.customLink.enabled && !value.customLink.url) {
    ctx.addIssue({ code: 'custom', path: ['customLink', 'url'], message: v.paymentTextRequired });
  }
});

export const yookassaConnectSchema = z.object({
  shopId: z.string().trim().min(1, v.paymentCredentialRequired).max(64, v.paymentFieldTooLong),
  secretKey: z.string().trim().max(256, v.paymentFieldTooLong).optional(),
});

export const bogConnectSchema = z.object({
  clientId: z.string().trim().min(1, v.paymentCredentialRequired).max(128, v.paymentFieldTooLong),
  clientSecret: z.string().trim().max(256, v.paymentFieldTooLong).optional(),
});

export const paymentActiveProviderSchema = z.object({
  provider: z.enum(['stripe', 'yookassa', 'bog']).nullable(),
});
