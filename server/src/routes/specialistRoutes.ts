import { Router } from 'express';
import { specialistCreateSchema, specialistUpdateSchema } from '../config/schemas.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  getAvailableSpecialistWebUsersForActor,
  createSpecialistForActor,
  deleteSpecialistForActor,
  getSpecialistsForActor,
  updateSpecialistForActor,
} from '../services/specialistService.js';
import { formatZodError } from '../utils/validation.js';

export const specialistRoutes = Router();

specialistRoutes.use(requireAccessToken);

specialistRoutes.get('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;

  try {
    const [specialists, availableWebUsers] = await Promise.all([
      getSpecialistsForActor(actor),
      getAvailableSpecialistWebUsersForActor(actor),
    ]);
    return res.json({ specialists, availableWebUsers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'specialistsLoadFailed') });
  }
});

specialistRoutes.post('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const parsed = specialistCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const created = await createSpecialistForActor(actor, parsed.data);
    return res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenCreateSpecialist') });
    }
    if (message === 'WEB_USER_NOT_AVAILABLE') {
      return res.status(400).json({ message: t(req, 'specialistWebUserUnavailable') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'specialistCreateFailed') });
  }
});

specialistRoutes.patch('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const specialistId = Number(req.params.id);

  if (!Number.isInteger(specialistId) || specialistId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidSpecialistId') });
  }

  const parsed = specialistUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await updateSpecialistForActor(actor, specialistId, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'specialistNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenUpdateSpecialist') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'specialistUpdateFailed') });
  }
});

specialistRoutes.delete('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const specialistId = Number(req.params.id);

  if (!Number.isInteger(specialistId) || specialistId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidSpecialistId') });
  }

  try {
    const deleted = await deleteSpecialistForActor(actor, specialistId);

    if (!deleted) {
      return res.status(404).json({ message: t(req, 'specialistNotFound') });
    }

    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenDeleteSpecialist') });
    }

    if (message === 'SPECIALIST_HAS_APPOINTMENTS') {
      return res.status(409).json({ message: t(req, 'specialistHasAppointments') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'specialistDeleteFailed') });
  }
});
