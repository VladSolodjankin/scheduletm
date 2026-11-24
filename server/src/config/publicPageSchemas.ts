import { z } from 'zod';
import { isIanaTimezone } from '@scheduletm/shared/public-page';

/** HTTP request bodies and queries of the public page API; the page document itself lives in @scheduletm/shared. */
export const savePublicPageDraftSchema = z.object({
  document: z.unknown(),
  expectedRevision: z.number().int().nonnegative(),
}).strict();
export const createPublicPageSchema = z.object({
  document: z.unknown(),
}).strict();
export const publicPageRevisionSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
}).strict();
export const publicPageListStatusSchema = z.enum(['active', 'draft', 'published', 'archived', 'all']);

const optionalContact = z.string().trim().max(320).optional();
export const publicBookingSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: optionalContact.refine((value) => !value || z.email().safeParse(value).success),
  phone: optionalContact.refine((value) => !value || /^\+?[0-9 ()-]{7,30}$/.test(value)),
  telegramUsername: z.string().trim().max(64).optional(),
  specialistId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  startAt: z.iso.datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(100).refine(isIanaTimezone).optional(),
  meetingProvider: z.enum(['manual', 'zoom', 'yandex_telemost', 'offline']).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.email?.trim() && !value.phone?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_or_phone_required' });
  }
});

export const publicAppointmentStatusQuerySchema = z.object({
  accessCode: z.string().trim().min(1).max(32),
}).strict();

export const publicAvailableSlotsQuerySchema = z.object({
  specialistId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();
