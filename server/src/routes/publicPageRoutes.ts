import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  publicAppointmentStatusQuerySchema,
  publicBookingSchema,
  createPublicPageSchema,
  publicPageListStatusSchema,
  publicPageRevisionSchema,
  savePublicPageDraftSchema,
} from '../config/publicPageSchemas.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { canManageAccountSettings } from '../policies/rolePermissions.js';
import { PublicPageRepositoryError } from '../repositories/publicPageRepository.js';
import { PublicBookingRepositoryError } from '../repositories/publicBookingRepository.js';
import {
  bookPublicAppointment,
  getPublicAppointmentStatus,
  getPublicBookingOptions,
  PublicBookingServiceError,
} from '../services/publicBookingService.js';
import {
  archivePublicPageForAccount,
  createPublicPageForAccount,
  deletePublicPageForAccount,
  getPublicPage,
  getPublicPages,
  getPublishedPublicPage,
  publishPublicPageForAccount,
  PublicPageServiceError,
  putPublicPageDraft,
  toPublicPageDto,
} from '../services/publicPageService.js';

const pageIdSchema = z.string().min(1).max(128);
const slugSchema = z.string().min(1).max(40);
const appointmentIdSchema = z.coerce.number().int().positive();
const publicStatusRateLimit = createRequestRateLimit({
  keyPrefix: 'public-appointment-status',
  maxRequests: 30,
  windowMs: 60_000,
});
export const publicPageRoutes = Router();

function sendError(res: Response, error: unknown) {
  if (error instanceof PublicBookingServiceError) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ code: 'not_found' });
    if (error.code === 'SLOT_UNAVAILABLE') return res.status(409).json({ code: 'slot_unavailable' });
    return res.status(422).json({ code: 'invalid_selection' });
  }
  if (error instanceof PublicBookingRepositoryError) {
    return res.status(409).json({ code: 'slot_conflict' });
  }
  if (error instanceof PublicPageServiceError) {
    if (error.code === 'UNSUPPORTED_VERSION') return res.status(400).json({ code: 'unsupported_version' });
    if (error.code === 'INVALID_DOCUMENT') return res.status(400).json({ code: 'invalid_document' });
    return res.status(422).json({ code: 'publish_validation_failed', issues: error.issues });
  }
  if (error instanceof PublicPageRepositoryError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return res.status(404).json({ code: 'not_found' });
      case 'REVISION_CONFLICT':
        return res.status(409).json({
          code: 'revision_conflict',
          ...(error.current ? { current: toPublicPageDto(error.current) } : {}),
        });
      case 'SLUG_CONFLICT':
        return res.status(409).json({ code: 'slug_conflict' });
      case 'PAGE_NOT_ARCHIVED':
        return res.status(409).json({ code: 'page_not_archived' });
      case 'QUOTA_EXCEEDED':
        return res.status(409).json({ code: 'quota_exceeded' });
    }
  }
  console.error(error);
  return res.status(500).json({ code: 'internal_error' });
}

publicPageRoutes.get('/by-slug/:slug', async (req, res) => {
  try {
    const parsed = slugSchema.safeParse(req.params.slug);
    if (!parsed.success) return res.status(404).json({ code: 'not_found' });
    const document = await getPublishedPublicPage(parsed.data);
    return document ? res.json(document) : res.status(404).json({ code: 'not_found' });
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.get('/by-slug/:slug/booking-options', async (req, res) => {
  try {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) return res.status(404).json({ code: 'not_found' });
    return res.json(await getPublicBookingOptions(slug.data));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.post('/by-slug/:slug/appointments', async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug);
  const requestedProvider = typeof req.body === 'object' && req.body !== null
    ? (req.body as { meetingProvider?: unknown }).meetingProvider
    : undefined;
  if (
    requestedProvider !== undefined
    && !['manual', 'zoom', 'offline'].includes(String(requestedProvider))
  ) {
    return res.status(422).json({ code: 'invalid_selection' });
  }
  const input = publicBookingSchema.safeParse(req.body);
  if (!slug.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.status(201).json(await bookPublicAppointment(slug.data, input.data));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.get(
  '/by-slug/:slug/appointments/:appointmentId/status',
  publicStatusRateLimit,
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const slug = slugSchema.safeParse(req.params.slug);
    const appointmentId = appointmentIdSchema.safeParse(req.params.appointmentId);
    const query = publicAppointmentStatusQuerySchema.safeParse(req.query);
    if (!slug.success || !appointmentId.success || !query.success) {
      return res.status(400).json({ code: 'invalid_request' });
    }
    try {
      return res.json(await getPublicAppointmentStatus(
        slug.data,
        appointmentId.data,
        query.data.specialistLastName,
      ));
    } catch (error) {
      return sendError(res, error);
    }
  },
);

publicPageRoutes.use(requireAccessToken);
publicPageRoutes.use((req, res, next) => {
  const actor = (req as unknown as AuthedRequest).user;
  return canManageAccountSettings(actor.role) ? next() : res.status(403).json({ code: 'forbidden' });
});

publicPageRoutes.get('/', async (req, res) => {
  try {
    const status = publicPageListStatusSchema.safeParse(req.query.status ?? 'active');
    if (!status.success) return res.status(400).json({ code: 'invalid_request' });
    return res.json(await getPublicPages((req as unknown as AuthedRequest).user.accountId, status.data));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.get('/:pageId', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    if (!pageId.success) return res.status(400).json({ code: 'invalid_request' });
    const page = await getPublicPage((req as unknown as AuthedRequest).user.accountId, pageId.data);
    return page ? res.json(page) : res.status(404).json({ code: 'not_found' });
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.post('/', async (req, res) => {
  const input = createPublicPageSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.status(201).json(await createPublicPageForAccount(
      (req as unknown as AuthedRequest).user.accountId,
      input.data.document,
    ));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.put('/:pageId/draft', async (req, res) => {
  const pageId = pageIdSchema.safeParse(req.params.pageId);
  const input = savePublicPageDraftSchema.safeParse(req.body);
  if (!pageId.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.json(await putPublicPageDraft({
      accountId: (req as unknown as AuthedRequest).user.accountId,
      pageId: pageId.data,
      ...input.data,
    }));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.post('/:pageId/publish', async (req, res) => {
  const pageId = pageIdSchema.safeParse(req.params.pageId);
  const input = publicPageRevisionSchema.safeParse(req.body);
  if (!pageId.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.json(await publishPublicPageForAccount(
      (req as unknown as AuthedRequest).user.accountId, pageId.data, input.data.expectedRevision,
    ));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.post('/:pageId/archive', async (req, res) => {
  const pageId = pageIdSchema.safeParse(req.params.pageId);
  const input = publicPageRevisionSchema.safeParse(req.body);
  if (!pageId.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.json(await archivePublicPageForAccount(
      (req as unknown as AuthedRequest).user.accountId, pageId.data, input.data.expectedRevision,
    ));
  } catch (error) {
    return sendError(res, error);
  }
});

publicPageRoutes.delete('/:pageId', async (req, res) => {
  const pageId = pageIdSchema.safeParse(req.params.pageId);
  const input = publicPageRevisionSchema.safeParse(req.body);
  if (!pageId.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    await deletePublicPageForAccount(
      (req as unknown as AuthedRequest).user.accountId, pageId.data, input.data.expectedRevision,
    );
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
});
