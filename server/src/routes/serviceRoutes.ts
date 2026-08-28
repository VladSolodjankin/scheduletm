import { Router } from 'express';
import { serviceAssignmentUpdateSchema, serviceCreateSchema, serviceUpdateSchema } from '../config/schemas.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  createServiceForActor,
  deleteServiceForActor,
  getServiceDeleteImpactForActor,
  getServicesForActor,
  ServiceCatalogError,
  updateAssignmentForActor,
  updateServiceForActor,
} from '../services/serviceService.js';
import { formatZodError } from '../utils/validation.js';

export const serviceRoutes = Router();
serviceRoutes.use(requireAccessToken);

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const statusFor = (error: ServiceCatalogError) =>
  error.code === 'FORBIDDEN' ? 403
    : error.code === 'NOT_FOUND' || error.code === 'MEDIA_NOT_FOUND' ? 404
      : error.code === 'CONFLICT' || error.code === 'SERVICE_IN_USE' ? 409 : 400;
const handleError = (error: unknown, res: Parameters<Parameters<typeof serviceRoutes.get>[1]>[1]) => {
  if (error instanceof ServiceCatalogError) {
    if (error.code === 'SERVICE_IN_USE') {
      return res.status(409).json({ code: 'service_in_use', impact: error.impact });
    }
    return res.status(statusFor(error)).json({ code: error.code.toLowerCase() });
  }
  console.error(error);
  return res.status(500).json({ code: 'internal_error' });
};

serviceRoutes.get('/', async (req, res) => {
  try {
    return res.json(await getServicesForActor((req as AuthedRequest).user));
  } catch (error) { return handleError(error, res); }
});

serviceRoutes.post('/', async (req, res) => {
  const parsed = serviceCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  try {
    return res.status(201).json(await createServiceForActor((req as AuthedRequest).user, parsed.data));
  } catch (error) { return handleError(error, res); }
});

serviceRoutes.get('/:id/delete-impact', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ code: 'invalid_service_id' });
  try {
    return res.json(await getServiceDeleteImpactForActor((req as unknown as AuthedRequest).user, id));
  } catch (error) { return handleError(error, res); }
});

serviceRoutes.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ code: 'invalid_service_id' });
  try {
    await deleteServiceForActor((req as unknown as AuthedRequest).user, id);
    return res.status(204).send();
  } catch (error) { return handleError(error, res); }
});

serviceRoutes.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ code: 'invalid_service_id' });
  const parsed = serviceUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  try {
    return res.json(await updateServiceForActor((req as unknown as AuthedRequest).user, id, parsed.data));
  } catch (error) { return handleError(error, res); }
});

serviceRoutes.patch('/:serviceId/specialists/:specialistId', async (req, res) => {
  const serviceId = parseId(req.params.serviceId);
  const specialistId = parseId(req.params.specialistId);
  if (!serviceId || !specialistId) return res.status(400).json({ code: 'invalid_id' });
  const parsed = serviceAssignmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  try {
    return res.json(await updateAssignmentForActor((req as unknown as AuthedRequest).user, serviceId, specialistId, parsed.data));
  } catch (error) { return handleError(error, res); }
});
