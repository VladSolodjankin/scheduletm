import { Router } from 'express';
import {
  appointmentCreateSchema,
  appointmentRescheduleSchema,
  appointmentUpdateSchema,
} from '../config/schemas.js';
import { t } from '../i18n/index.js';
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
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'CLIENT_PROFILE_NOT_FOUND') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentsLoadFailed') });
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
      return res.status(403).json({ message: t(req, 'forbiddenSpecialistScope') });
    }
    if (message === 'FORBIDDEN_CLIENT') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }

    if (message === 'SPECIALIST_NOT_FOUND') {
      return res.status(404).json({ message: t(req, 'specialistNotFound') });
    }

    if (message === 'CLIENT_NOT_FOUND') {
      return res.status(404).json({ message: t(req, 'clientNotFound') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentCreateFailed') });
  }
});

appointmentRoutes.patch('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidAppointmentId') });
  }

  const parsed = appointmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await updateAppointmentForActor(actor, appointmentId, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'appointmentNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'FORBIDDEN_CLIENT') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'CLIENT_NOT_FOUND') {
      return res.status(404).json({ message: t(req, 'clientNotFound') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentUpdateFailed') });
  }
});

appointmentRoutes.post('/:id/cancel', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidAppointmentId') });
  }

  try {
    const updated = await cancelAppointmentForActor(actor, appointmentId);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'appointmentNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'FORBIDDEN_CLIENT') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentCancelFailed') });
  }
});

appointmentRoutes.post('/:id/reschedule', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidAppointmentId') });
  }

  const parsed = appointmentRescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await rescheduleAppointmentForActor(actor, appointmentId, parsed.data.scheduledAt);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'appointmentNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'FORBIDDEN_CLIENT') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentRescheduleFailed') });
  }
});

appointmentRoutes.post('/:id/mark-paid', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidAppointmentId') });
  }

  try {
    const updated = await markPaidAppointmentForActor(actor, appointmentId);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'appointmentNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'FORBIDDEN_CLIENT') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentMarkPaidFailed') });
  }
});

appointmentRoutes.post('/:id/notify', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidAppointmentId') });
  }

  try {
    const updated = await notifyAppointmentForActor(actor, appointmentId);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'appointmentNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (message === 'FORBIDDEN_SPECIALIST') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'FORBIDDEN_CLIENT') {
      return res.status(403).json({ message: t(req, 'forbiddenAppointmentScope') });
    }
    if (message === 'NOTIFICATION_DELIVERY_FAILED') {
      return res.status(502).json({ message: t(req, 'appointmentNotifyFailed') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'appointmentNotifyFailed') });
  }
});
