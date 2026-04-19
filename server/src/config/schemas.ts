import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Z]/, 'must contain uppercase letter')
  .regex(/[a-z]/, 'must contain lowercase letter')
  .regex(/[0-9]/, 'must contain number');

export const registrationSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema
});

export const loginSchema = registrationSchema;

export const settingsSchema = z.object({
  timezone: z.string().min(1).max(64),
  dailyDigestEnabled: z.boolean(),
  defaultMeetingDuration: z.coerce.number().int().min(15).max(180),
  weekStartsOnMonday: z.boolean(),
  locale: z.string().min(2).max(16)
});
