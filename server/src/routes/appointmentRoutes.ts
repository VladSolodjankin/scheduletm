import { Router } from 'express';
import {
  appointmentCreateSchema,
  appointmentRescheduleSchema,
  appointmentUpdateSchema,
} from '../config/schemas.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  cancelAppointmentForActor,
  createAppointmentForActor,
  getAppointments,
  markPaidAppointmentForActor,
  notifyAppointmentForActor,
  rescheduleAppointmentForActor,
  updateAppointmentForActor,
} from '../services/appointmentService.js';
import { formatZodError } from '../utils/validation.js';

export const appointmentRoutes = Router();

appointmentRoutes.use(requireAccessToken);

appointmentRoutes.get('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;

  try {
    const specialistId = typeof req.query.specialistId === 'string'
      ? Number(req.query.specialistId)
      : undefined;

    const data = await getAppointments(actor, {
      specialistId: Number.isFinite(specialistId) ? specialistId : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
    });

    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось загрузить записи' });
  }
});

appointmentRoutes.post('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const parsed = appointmentCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const created = await createAppointmentForActor(actor, parsed.data);
    return res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: 'Недостаточно прав для этого специалиста' });
    }

    if (message === 'SPECIALIST_NOT_FOUND') {
      return res.status(404).json({ message: 'Специалист не найден' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать запись' });
  }
});

appointmentRoutes.patch('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: 'Некорректный id записи' });
  }

  const parsed = appointmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await updateAppointmentForActor(actor, appointmentId, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: 'Недостаточно прав для этой записи' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить запись' });
  }
});

appointmentRoutes.post('/:id/cancel', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: 'Некорректный id записи' });
  }

  try {
    const updated = await cancelAppointmentForActor(actor, appointmentId);
    if (!updated) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: 'Недостаточно прав для этой записи' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось отменить запись' });
  }
});

appointmentRoutes.post('/:id/reschedule', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: 'Некорректный id записи' });
  }

  const parsed = appointmentRescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await rescheduleAppointmentForActor(actor, appointmentId, parsed.data.scheduledAt);
    if (!updated) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: 'Недостаточно прав для этой записи' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось перенести запись' });
  }
});

appointmentRoutes.post('/:id/mark-paid', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: 'Некорректный id записи' });
  }

  try {
    const updated = await markPaidAppointmentForActor(actor, appointmentId);
    if (!updated) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: 'Недостаточно прав для этой записи' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось подтвердить оплату' });
  }
});

appointmentRoutes.post('/:id/notify', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: 'Некорректный id записи' });
  }

  try {
    const updated = await notifyAppointmentForActor(actor, appointmentId);
    if (!updated) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: 'Недостаточно прав для этой записи' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось отправить уведомление' });
  }
});
