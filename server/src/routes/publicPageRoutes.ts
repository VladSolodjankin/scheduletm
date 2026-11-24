import { raw, Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  publicAppointmentStatusQuerySchema,
  publicAvailableSlotsQuerySchema,
  publicBookingSchema,
  createPublicPageSchema,
  publicPageListStatusSchema,
  publicPageRevisionSchema,
  savePublicPageDraftSchema,
} from '../config/publicPageSchemas.js';
import { isValidPublicPageSlug, normalizePublicPageSlug } from '@scheduletm/shared/public-page';
import { PUBLIC_PAGE_ANALYTICS_PERIODS, publicPageEventSchema } from '@scheduletm/shared/public-page-analytics';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { canManageAccountSettings, canReadAccountMedia } from '../policies/rolePermissions.js';
import { listPublishedPublicPageSlugs, PublicPageRepositoryError } from '../repositories/publicPageRepository.js';
import { PublicBookingRepositoryError } from '../repositories/publicBookingRepository.js';
import {
  bookPublicAppointment,
  getPublicAppointmentStatus,
  getPublicAvailableSlots,
  getPublicBookingOptions,
  getPublicReviewsBySlug,
  PublicBookingServiceError,
} from '../services/publicBookingService.js';
import {
  archivePublicPageForAccount,
  createPublicPageForAccount,
  deletePublicPageForAccount,
  getPublicPage,
  getPublicPageSlugAvailability,
  getPublicPages,
  getPublishedPublicPage,
  publishPublicPageForAccount,
  PublicPageServiceError,
  putPublicPageDraft,
  restorePublicPageForAccount,
  toPublicPageDto,
} from '../services/publicPageService.js';
import {
  getPublicPageDomain,
  getPublishedPublicPageByDomain,
  removePublicPageDomain,
  setPublicPageDomain,
  verifyPublicPageDomain,
} from '../services/publicPageDomainService.js';
import { getPublicPageAnalytics, recordPublicPageEvent } from '../services/publicPageAnalyticsService.js';
import { publicPageMediaUrl } from '../utils/publicPageMediaUrl.js';
import { trackServerError } from '../services/errorTrackingService.js';
import {
  deletePublicPageMedia,
  getAccountPublicPageMedia,
  getPublishedPublicPageMedia,
  PUBLIC_PAGE_MEDIA_MAX_BYTES,
  PublicPageMediaError,
  uploadPublicPageMedia,
} from '../services/publicPageMediaService.js';

const pageIdSchema = z.string().min(1).max(128);
const slugSchema = z.string().min(1).max(40);
const slugAvailabilityQuerySchema = z.object({
  slug: z.string().transform(normalizePublicPageSlug).refine(isValidPublicPageSlug),
  pageId: pageIdSchema.optional(),
}).strict();
const appointmentIdSchema = z.coerce.number().int().positive();
const mediaIdSchema = z.string().uuid();
const publicStatusRateLimit = createRequestRateLimit({
  keyPrefix: 'public-appointment-status',
  maxRequests: 30,
  windowMs: 60_000,
});
const publicPageLookupRateLimit = createRequestRateLimit({
  keyPrefix: 'public-page-lookup',
  maxRequests: 60,
  windowMs: 60_000,
});
const publicPageEventRateLimit = createRequestRateLimit({
  keyPrefix: 'public-page-event',
  maxRequests: 120,
  windowMs: 60_000,
});
const analyticsQuerySchema = z.object({
  days: z.coerce.number().pipe(z.union(PUBLIC_PAGE_ANALYTICS_PERIODS.map((period) => z.literal(period)) as [z.ZodLiteral<7>, z.ZodLiteral<30>, z.ZodLiteral<90>])),
}).strict();
const domainSchema = z.string().min(1).max(253);
const domainBodySchema = z.object({ domain: z.string().min(1).max(253) }).strict();
const publicPageMediaRateLimit = createRequestRateLimit({
  keyPrefix: 'public-page-media',
  maxRequests: 120,
  windowMs: 60_000,
});
const publicBookingOptionsRateLimit = createRequestRateLimit({
  keyPrefix: 'public-booking-options',
  maxRequests: 60,
  windowMs: 60_000,
});
export const publicPageRoutes = Router();

function mediaError(req: Request, res: Response, error: unknown) {
  if (error instanceof PublicPageMediaError) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ code: 'not_found' });
    if (error.code === 'MEDIA_IN_USE') return res.status(409).json({ code: 'media_in_use' });
    if (error.code === 'UNSUPPORTED_MEDIA') return res.status(415).json({ code: 'unsupported_media' });
    return res.status(503).json({ code: 'storage_unavailable' });
  }
  void trackServerError({ method: req.method, path: req.path, error });
  res.locals.errorTracked = true;
  return res.status(500).json({ code: 'internal_error' });
}

const rawMediaBody = raw({
  type: ['image/jpeg', 'image/png', 'image/webp'],
  limit: PUBLIC_PAGE_MEDIA_MAX_BYTES,
});
const parseRawMedia = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    return res.status(415).json({ code: 'unsupported_media' });
  }
  rawMediaBody(req, res, (error?: unknown) => {
    if (error && typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
      return res.status(413).json({ code: 'media_too_large' });
    }
    if (error) return res.status(400).json({ code: 'invalid_request' });
    return next();
  });
};

function sendError(req: Request, res: Response, error: unknown) {
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
    if (error.code === 'INVALID_SLUG') return res.status(400).json({ code: 'invalid_request' });
    if (error.code === 'INVALID_DOMAIN') return res.status(400).json({ code: 'invalid_domain' });
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
      case 'DOMAIN_CONFLICT':
        return res.status(409).json({ code: 'domain_conflict' });
      case 'PAGE_NOT_ARCHIVED':
        return res.status(409).json({ code: 'page_not_archived' });
      case 'QUOTA_EXCEEDED':
        return res.status(409).json({ code: 'quota_exceeded' });
    }
  }
  void trackServerError({ method: req.method, path: req.path, error });
  res.locals.errorTracked = true;
  return res.status(500).json({ code: 'internal_error' });
}

publicPageRoutes.get('/sitemap', publicPageLookupRateLimit, async (req, res) => {
  try {
    return res.json({ slugs: await listPublishedPublicPageSlugs() });
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/by-domain/:domain', publicPageLookupRateLimit, async (req, res) => {
  try {
    const domain = domainSchema.safeParse(req.params.domain);
    if (!domain.success) return res.status(404).json({ code: 'not_found' });
    const document = await getPublishedPublicPageByDomain(domain.data);
    return document ? res.json(document) : res.status(404).json({ code: 'not_found' });
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/by-slug/:slug', publicPageLookupRateLimit, async (req, res) => {
  try {
    const parsed = slugSchema.safeParse(req.params.slug);
    if (!parsed.success) return res.status(404).json({ code: 'not_found' });
    const document = await getPublishedPublicPage(parsed.data);
    return document ? res.json(document) : res.status(404).json({ code: 'not_found' });
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.post('/by-slug/:slug/events', publicPageEventRateLimit, async (req, res) => {
  try {
    const slug = slugSchema.safeParse(req.params.slug);
    const event = publicPageEventSchema.safeParse(req.body);
    if (!slug.success || !event.success) return res.status(400).json({ code: 'invalid_request' });
    await recordPublicPageEvent(normalizePublicPageSlug(slug.data), event.data, req.get('user-agent'));
    return res.status(204).end();
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/media/:mediaId/content', publicPageMediaRateLimit, async (req, res) => {
  const id = mediaIdSchema.safeParse(req.params.mediaId);
  if (!id.success) return res.status(404).json({ code: 'not_found' });
  try {
    const media = await getPublishedPublicPageMedia(id.data);
    if (!media) return res.status(404).json({ code: 'not_found' });
    res.setHeader('Content-Type', media.record.mime);
    res.setHeader('Content-Length', String(media.record.bytes));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.from(media.body));
  } catch (error) {
    return mediaError(req, res, error);
  }
});

publicPageRoutes.get('/by-slug/:slug/reviews', publicBookingOptionsRateLimit, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) return res.status(404).json({ code: 'not_found' });
    return res.json(await getPublicReviewsBySlug(slug.data));
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/by-slug/:slug/booking-options', publicBookingOptionsRateLimit, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) return res.status(404).json({ code: 'not_found' });
    return res.json(await getPublicBookingOptions(slug.data));
  } catch (error) {
    return sendError(req, res, error);
  }
});
const publicAvailableSlotsRateLimit = createRequestRateLimit({
  keyPrefix: 'public-available-slots',
  maxRequests: 60,
  windowMs: 60_000,
});

publicPageRoutes.get('/by-slug/:slug/available-slots', publicAvailableSlotsRateLimit, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const slug = slugSchema.safeParse(req.params.slug);
  const query = publicAvailableSlotsQuerySchema.safeParse(req.query);
  if (!slug.success || !query.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.json(await getPublicAvailableSlots(slug.data, query.data.specialistId, query.data.serviceId, query.data.date));
  } catch (error) {
    return sendError(req, res, error);
  }
});
const publicBookingRateLimit = createRequestRateLimit({
  keyPrefix: 'public-appointment-create',
  maxRequests: 10,
  windowMs: 60_000,
});

publicPageRoutes.post('/by-slug/:slug/appointments', publicBookingRateLimit, async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug);
  const requestedProvider = typeof req.body === 'object' && req.body !== null
    ? (req.body as { meetingProvider?: unknown }).meetingProvider
    : undefined;
  if (
    requestedProvider !== undefined
    && !['manual', 'zoom', 'yandex_telemost', 'offline'].includes(String(requestedProvider))
  ) {
    return res.status(422).json({ code: 'invalid_selection' });
  }
  const input = publicBookingSchema.safeParse(req.body);
  if (!slug.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.status(201).json(await bookPublicAppointment(slug.data, input.data));
  } catch (error) {
    return sendError(req, res, error);
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
        query.data.accessCode,
      ));
    } catch (error) {
      return sendError(req, res, error);
    }
  },
);

publicPageRoutes.use(requireAccessToken);

publicPageRoutes.get('/media/:mediaId/preview', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  if (!canReadAccountMedia(actor.role)) return res.status(403).json({ code: 'forbidden' });
  const id = mediaIdSchema.safeParse(req.params.mediaId);
  if (!id.success) return res.status(404).json({ code: 'not_found' });
  try {
    const media = await getAccountPublicPageMedia(
      actor.accountId,
      id.data,
    );
    if (!media) return res.status(404).json({ code: 'not_found' });
    res.setHeader('Content-Type', media.record.mime);
    res.setHeader('Content-Length', String(media.record.bytes));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(Buffer.from(media.body));
  } catch (error) {
    return mediaError(req, res, error);
  }
});

publicPageRoutes.use((req, res, next) => {
  const actor = (req as unknown as AuthedRequest).user;
  return canManageAccountSettings(actor.role) ? next() : res.status(403).json({ code: 'forbidden' });
});

publicPageRoutes.post('/media', parseRawMedia, async (req, res) => {
  const contentType = req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ code: 'invalid_request' });
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    return res.status(415).json({ code: 'unsupported_media' });
  }
  try {
    const media = await uploadPublicPageMedia(
      (req as unknown as AuthedRequest).user.accountId,
      req.body,
      contentType,
    );
    return res.status(201).json({
      id: media.id,
      url: publicPageMediaUrl(media.id),
      mimeType: media.mime,
      alt: '',
      width: media.width ?? 0,
      height: media.height ?? 0,
    });
  } catch (error) {
    return mediaError(req, res, error);
  }
});

publicPageRoutes.delete('/media/:mediaId', async (req, res) => {
  const id = mediaIdSchema.safeParse(req.params.mediaId);
  if (!id.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    await deletePublicPageMedia((req as unknown as AuthedRequest).user.accountId, id.data);
    return res.status(204).send();
  } catch (error) {
    return mediaError(req, res, error);
  }
});

publicPageRoutes.get('/', async (req, res) => {
  try {
    const status = publicPageListStatusSchema.safeParse(req.query.status ?? 'active');
    if (!status.success) return res.status(400).json({ code: 'invalid_request' });
    return res.json(await getPublicPages((req as unknown as AuthedRequest).user.accountId, status.data));
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/slug-availability', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const query = slugAvailabilityQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.json(await getPublicPageSlugAvailability(
      (req as unknown as AuthedRequest).user.accountId,
      query.data.slug,
      query.data.pageId,
    ));
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/:pageId/domain', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    if (!pageId.success) return res.status(400).json({ code: 'invalid_request' });
    return res.json({ domain: await getPublicPageDomain((req as unknown as AuthedRequest).user.accountId, pageId.data) });
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.put('/:pageId/domain', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    const body = domainBodySchema.safeParse(req.body);
    if (!pageId.success || !body.success) return res.status(400).json({ code: 'invalid_request' });
    return res.json({ domain: await setPublicPageDomain((req as unknown as AuthedRequest).user.accountId, pageId.data, body.data.domain) });
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.post('/:pageId/domain/verify', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    if (!pageId.success) return res.status(400).json({ code: 'invalid_request' });
    return res.json({ domain: await verifyPublicPageDomain((req as unknown as AuthedRequest).user.accountId, pageId.data) });
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.delete('/:pageId/domain', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    if (!pageId.success) return res.status(400).json({ code: 'invalid_request' });
    await removePublicPageDomain((req as unknown as AuthedRequest).user.accountId, pageId.data);
    return res.status(204).end();
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/:pageId/analytics', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    const query = analyticsQuerySchema.safeParse(req.query);
    if (!pageId.success || !query.success) return res.status(400).json({ code: 'invalid_request' });
    return res.json(await getPublicPageAnalytics((req as unknown as AuthedRequest).user.accountId, pageId.data, query.data.days));
  } catch (error) {
    return sendError(req, res, error);
  }
});

publicPageRoutes.get('/:pageId', async (req, res) => {
  try {
    const pageId = pageIdSchema.safeParse(req.params.pageId);
    if (!pageId.success) return res.status(400).json({ code: 'invalid_request' });
    const page = await getPublicPage((req as unknown as AuthedRequest).user.accountId, pageId.data);
    return page ? res.json(page) : res.status(404).json({ code: 'not_found' });
  } catch (error) {
    return sendError(req, res, error);
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
    return sendError(req, res, error);
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
    return sendError(req, res, error);
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
    return sendError(req, res, error);
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
    return sendError(req, res, error);
  }
});

publicPageRoutes.post('/:pageId/restore', async (req, res) => {
  const pageId = pageIdSchema.safeParse(req.params.pageId);
  const input = publicPageRevisionSchema.safeParse(req.body);
  if (!pageId.success || !input.success) return res.status(400).json({ code: 'invalid_request' });
  try {
    return res.json(await restorePublicPageForAccount(
      (req as unknown as AuthedRequest).user.accountId, pageId.data, input.data.expectedRevision,
    ));
  } catch (error) {
    return sendError(req, res, error);
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
    return sendError(req, res, error);
  }
});
