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
  timezone: z.string().min(1, 'Укажите часовой пояс').max(64, 'Часовой пояс слишком длинный'),
  dailyDigestEnabled: z.boolean(),
  defaultMeetingDuration: z.coerce
    .number()
    .int('Длительность встречи должна быть целым числом')
    .min(15, 'Минимальная длительность встречи — 15 минут')
    .max(180, 'Максимальная длительность встречи — 180 минут'),
  weekStartsOnMonday: z.boolean(),
  locale: z.string().min(2, 'Укажите язык/локаль').max(16, 'Локаль слишком длинная'),
}).partial();

export const userSettingsSchema = z.object({
  timezone: timezoneSchema,
  locale: z.string().min(2, 'Укажите язык/локаль').max(16, 'Локаль слишком длинная'),
  uiThemeMode: z.enum(['light', 'dark']),
  uiPaletteVariantId: z.string().min(1, 'Укажите id палитры').max(64, 'Id палитры слишком длинный')
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

const appointmentStatusSchema = z.enum(['new', 'confirmed', 'cancelled']);

export const appointmentCreateSchema = z.object({
  specialistId: z.coerce.number().int().positive('Укажите специалиста'),
  scheduledAt: z.string().datetime('Укажите корректную дату и время'),
  durationMin: z.coerce.number().int().min(15, 'Минимальная длительность — 15 минут').max(480, 'Максимальная длительность — 480 минут').optional(),
  status: appointmentStatusSchema.optional(),
  meetingLink: z.string().trim().url('Укажите корректную ссылку').max(2048).optional().or(z.literal('')),
  notes: z.string().trim().max(2000, 'Комментарий слишком длинный').optional(),
});

export const appointmentUpdateSchema = z.object({
  scheduledAt: z.string().datetime('Укажите корректную дату и время').optional(),
  durationMin: z.coerce.number().int().min(15, 'Минимальная длительность — 15 минут').max(480, 'Максимальная длительность — 480 минут').optional(),
  status: appointmentStatusSchema.optional(),
  meetingLink: z.string().trim().url('Укажите корректную ссылку').max(2048).optional().or(z.literal('')),
  notes: z.string().trim().max(2000, 'Комментарий слишком длинный').optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Передайте хотя бы одно поле для обновления',
});

export const appointmentRescheduleSchema = z.object({
  scheduledAt: z.string().datetime('Укажите корректную дату и время'),
});
