import { Router } from 'express';
import { specialistCreateSchema, specialistUpdateSchema } from '../config/schemas.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
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
    return res.json({ specialists: await getSpecialistsForActor(actor) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось загрузить специалистов' });
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
      return res.status(403).json({ message: 'Недостаточно прав для создания специалиста' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать специалиста' });
  }
});

specialistRoutes.patch('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const specialistId = Number(req.params.id);

  if (!Number.isInteger(specialistId) || specialistId <= 0) {
    return res.status(400).json({ message: 'Некорректный id специалиста' });
  }

  const parsed = specialistUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await updateSpecialistForActor(actor, specialistId, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: 'Специалист не найден' });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return res.status(403).json({ message: 'Недостаточно прав для изменения специалиста' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить специалиста' });
  }
});

specialistRoutes.delete('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const specialistId = Number(req.params.id);

  if (!Number.isInteger(specialistId) || specialistId <= 0) {
    return res.status(400).json({ message: 'Некорректный id специалиста' });
  }

  try {
    const deleted = await deleteSpecialistForActor(actor, specialistId);

    if (!deleted) {
      return res.status(404).json({ message: 'Специалист не найден' });
    }

    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return res.status(403).json({ message: 'Недостаточно прав для удаления специалиста' });
    }

    if (message === 'SPECIALIST_HAS_APPOINTMENTS') {
      return res.status(409).json({ message: 'Нельзя удалить специалиста с существующими записями' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось удалить специалиста' });
  }
});
