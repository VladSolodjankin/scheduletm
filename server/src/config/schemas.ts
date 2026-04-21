import { z } from 'zod';

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
  password: passwordSchema
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Введите корректный email')
    .max(254, 'Email слишком длинный'),
  password: z.string().min(1, 'Введите пароль')
});

export const settingsSchema = z.object({
  timezone: z.string().min(1, 'Укажите часовой пояс').max(64, 'Часовой пояс слишком длинный'),
  dailyDigestEnabled: z.boolean(),
  defaultMeetingDuration: z.coerce
    .number()
    .int('Длительность встречи должна быть целым числом')
    .min(15, 'Минимальная длительность встречи — 15 минут')
    .max(180, 'Максимальная длительность встречи — 180 минут'),
  weekStartsOnMonday: z.boolean(),
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
