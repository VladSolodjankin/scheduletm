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
});

export const loginSchema = z.object({
  email: z
    .string()
    .email(v.emailInvalid)
    .max(254, v.emailTooLong),
  password: z.string().min(1, v.loginPasswordRequired),
  timezone: timezoneSchema.optional(),
});

export const systemSettingsSchema = z.object({
  dailyDigestEnabled: z.boolean(),
  defaultMeetingDuration: z.coerce
    .number()
    .int(v.meetingDurationMustBeInteger)
    .min(15, v.meetingDurationMin)
    .max(180, v.meetingDurationMax),
  weekStartsOnMonday: z.boolean(),
}).partial();

export const userSettingsSchema = z.object({
  timezone: timezoneSchema,
  locale: z.string().min(2, v.localeRequired).max(16, v.localeTooLong),
  uiThemeMode: z.enum(['light', 'dark']),
  uiPaletteVariantId: z.string().min(1, v.paletteIdRequired).max(64, v.paletteIdTooLong),
  telegramBotToken: z.string().trim().min(1, v.telegramBotTokenRequired).max(255, v.telegramBotTokenTooLong).optional().or(z.literal('')),
}).partial();

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

const managedUserRoleSchema = z.enum(['admin', 'specialist']);

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
  name: z.string().trim().min(2, v.specialistNameMin).max(120, v.specialistNameMax).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: v.atLeastOneFieldToUpdate,
});

const appointmentStatusSchema = z.enum(['new', 'confirmed', 'cancelled']);

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
  notes: z.string().trim().max(2000, v.appointmentNotesTooLong).optional(),
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
