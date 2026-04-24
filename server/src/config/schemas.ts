import { z } from 'zod';

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
  .min(1, 'Укажите часовой пояс')
  .max(64, 'Часовой пояс слишком длинный')
  .refine(isValidIanaTimezone, 'Некорректный IANA timezone');

export const passwordSchema = z
  .string()
  .min(10, 'Пароль должен содержать минимум 10 символов')
  .max(128, 'Пароль не должен превышать 128 символов')
  .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
  .regex(/[a-z]/, 'Пароль должен содержать хотя бы одну строчную букву')
  .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру');

export const registrationSchema = z.object({
  email: z
    .string()
    .email('Введите корректный email')
    .max(254, 'Email слишком длинный'),
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Введите корректный email')
    .max(254, 'Email слишком длинный'),
  password: z.string().min(1, 'Введите пароль'),
  timezone: timezoneSchema.optional(),
});

export const systemSettingsSchema = z.object({
  dailyDigestEnabled: z.boolean(),
  defaultMeetingDuration: z.coerce
    .number()
    .int('Длительность встречи должна быть целым числом')
    .min(15, 'Минимальная длительность встречи — 15 минут')
    .max(180, 'Максимальная длительность встречи — 180 минут'),
  weekStartsOnMonday: z.boolean(),
}).partial();

export const userSettingsSchema = z.object({
  timezone: timezoneSchema,
  locale: z.string().min(2, 'Укажите язык/локаль').max(16, 'Локаль слишком длинная'),
  uiThemeMode: z.enum(['light', 'dark']),
  uiPaletteVariantId: z.string().min(1, 'Укажите id палитры').max(64, 'Id палитры слишком длинный'),
  telegramBotToken: z.string().trim().min(1, 'Укажите BOT_TOKEN').max(255, 'BOT_TOKEN слишком длинный').optional().or(z.literal('')),
}).partial();

export const specialistUserCreationSchema = z.object({
  email: z
    .string()
    .email('Введите корректный email')
    .max(254, 'Email слишком длинный'),
  password: passwordSchema,
  specialistName: z
    .string()
    .min(2, 'Имя специалиста должно содержать минимум 2 символа')
    .max(120, 'Имя специалиста слишком длинное')
});




const managedUserRoleSchema = z.enum(['admin', 'specialist']);
const managedUserSchemaDictionary = {
  emailInvalid: 'Введите корректный email',
  emailTooLong: 'Email слишком длинный',
  firstNameRequired: 'Укажите имя',
  firstNameTooLong: 'Имя слишком длинное',
  lastNameRequired: 'Укажите фамилию',
  lastNameTooLong: 'Фамилия слишком длинная',
  phoneTooLong: 'Телефон слишком длинный',
  telegramTooLong: 'Telegram аккаунт слишком длинный',
} as const;

export const managedUserCreateSchema = z.object({
  email: z.string().trim().email(managedUserSchemaDictionary.emailInvalid).max(254, managedUserSchemaDictionary.emailTooLong),
  role: managedUserRoleSchema,
  firstName: z.string().trim().min(1, managedUserSchemaDictionary.firstNameRequired).max(120, managedUserSchemaDictionary.firstNameTooLong),
  lastName: z.string().trim().min(1, managedUserSchemaDictionary.lastNameRequired).max(120, managedUserSchemaDictionary.lastNameTooLong),
  phone: z.string().trim().max(50, managedUserSchemaDictionary.phoneTooLong).optional().or(z.literal('')),
  telegramUsername: z.string().trim().max(255, managedUserSchemaDictionary.telegramTooLong).optional().or(z.literal('')),
});

export const managedUserUpdateSchema = managedUserCreateSchema;

export const specialistCreateSchema = z.object({
  userId: z.coerce.number().int().positive('Выберите пользователя специалиста'),
});

export const specialistUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Имя специалиста должно содержать минимум 2 символа').max(120, 'Имя специалиста слишком длинное').optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Передайте хотя бы одно поле для обновления',
});

const appointmentStatusSchema = z.enum(['new', 'confirmed', 'cancelled']);

const appointmentClientSchema = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  username: z.string().trim().max(255).optional(),
  firstName: z.string().trim().min(1, 'Укажите имя').max(255).optional(),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(255).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email('Введите корректный email').max(254).optional(),
});

export const appointmentCreateSchema = z.object({
  specialistId: z.coerce.number().int().positive('Укажите специалиста'),
  appointmentAt: z.string().datetime('Укажите корректную дату и время начала'),
  appointmentEndAt: z.string().datetime('Укажите корректную дату и время окончания'),
  status: appointmentStatusSchema.optional(),
  meetingLink: z.string().trim().url('Укажите корректную ссылку').max(2048).optional().or(z.literal('')),
  notes: z.string().trim().max(2000, 'Комментарий слишком длинный').optional(),
}).merge(appointmentClientSchema).superRefine((value, ctx) => {
  if (!value.firstName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstName'], message: 'Укажите имя' });
  }

  if (!value.lastName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'], message: 'Укажите фамилию' });
  }

  if (!value.username && !value.phone && !value.email && !value.clientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['username'],
      message: 'Укажите telegram username, телефон или email',
    });
  }

  const start = new Date(value.appointmentAt).getTime();
  const end = new Date(value.appointmentEndAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentEndAt'],
      message: 'Время окончания должно быть позже времени начала',
    });
    return;
  }

  const durationMin = Math.round((end - start) / 60_000);
  if (durationMin < 15 || durationMin > 480) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentEndAt'],
      message: 'Длительность встречи должна быть от 15 до 480 минут',
    });
  }
});

export const appointmentUpdateSchema = z.object({
  appointmentAt: z.string().datetime('Укажите корректную дату и время начала').optional(),
  appointmentEndAt: z.string().datetime('Укажите корректную дату и время окончания').optional(),
  durationMin: z.coerce.number().int().min(15, 'Минимальная длительность — 15 минут').max(480, 'Максимальная длительность — 480 минут').optional(),
  status: appointmentStatusSchema.optional(),
  meetingLink: z.string().trim().url('Укажите корректную ссылку').max(2048).optional().or(z.literal('')),
  notes: z.string().trim().max(2000, 'Комментарий слишком длинный').optional(),
}).merge(appointmentClientSchema).superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'Передайте хотя бы одно поле для обновления' });
    return;
  }

  if ((value.appointmentAt && !value.appointmentEndAt) || (!value.appointmentAt && value.appointmentEndAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentEndAt'],
      message: 'Передайте и время начала, и время окончания',
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
        message: 'Время окончания должно быть позже времени начала',
      });
      return;
    }

    const durationMin = Math.round((end - start) / 60_000);
    if (durationMin < 15 || durationMin > 480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['appointmentEndAt'],
        message: 'Длительность встречи должна быть от 15 до 480 минут',
      });
    }
  }
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Передайте хотя бы одно поле для обновления',
});

export const appointmentRescheduleSchema = z.object({
  scheduledAt: z.string().datetime('Укажите корректную дату и время'),
});
