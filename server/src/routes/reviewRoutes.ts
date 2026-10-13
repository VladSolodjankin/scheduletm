import { Router } from 'express';
import { reviewCreateSchema, reviewUpdateSchema } from '../config/schemas.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { canManageAccountSettings } from '../policies/rolePermissions.js';
import {
  createReviewForActor,
  deleteReviewForActor,
  listReviewsForActor,
  ReviewError,
  updateReviewForActor,
} from '../services/reviewService.js';
import { formatZodError } from '../utils/validation.js';
import { trackServerError } from '../services/errorTrackingService.js';

export const reviewRoutes = Router();
reviewRoutes.use(requireAccessToken);
reviewRoutes.use((req, res, next) => {
  const actor = (req as unknown as AuthedRequest).user;
  return canManageAccountSettings(actor.role) ? next() : res.status(403).json({ code: 'forbidden' });
});

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const statusFor = (error: ReviewError) =>
  error.code === 'NOT_FOUND' || error.code === 'MEDIA_NOT_FOUND' ? 404
    : error.code === 'REVIEW_LIMIT_REACHED' ? 409
      : error.code === 'FORBIDDEN' ? 403 : 400;
const handleError = (
  error: unknown,
  req: Parameters<Parameters<typeof reviewRoutes.get>[1]>[0],
  res: Parameters<Parameters<typeof reviewRoutes.get>[1]>[1],
) => {
  if (error instanceof ReviewError) return res.status(statusFor(error)).json({ code: error.code.toLowerCase() });
  void trackServerError({ method: req.method, path: req.path, error });
  res.locals.errorTracked = true;
  return res.status(500).json({ code: 'internal_error' });
};

reviewRoutes.get('/', async (req, res) => {
  try {
    return res.json(await listReviewsForActor((req as unknown as AuthedRequest).user));
  } catch (error) { return handleError(error, req, res); }
});

reviewRoutes.post('/', async (req, res) => {
  const parsed = reviewCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  try {
    return res.status(201).json(await createReviewForActor((req as unknown as AuthedRequest).user, parsed.data));
  } catch (error) { return handleError(error, req, res); }
});

reviewRoutes.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ code: 'invalid_review_id' });
  const parsed = reviewUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  try {
    return res.json(await updateReviewForActor((req as unknown as AuthedRequest).user, id, parsed.data));
  } catch (error) { return handleError(error, req, res); }
});

reviewRoutes.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ code: 'invalid_review_id' });
  try {
    await deleteReviewForActor((req as unknown as AuthedRequest).user, id);
    return res.status(204).send();
  } catch (error) { return handleError(error, req, res); }
});
