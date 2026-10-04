import { Router } from 'express';
import { appointmentRescheduleSchema } from '../config/schemas.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import { findService } from '../repositories/serviceRepository.js';
import { findSpecialistByIdAnyAccount } from '../repositories/specialistRepository.js';
import {
  AppointmentManagementTokenError,
  cancelAppointmentByManagementToken,
  rescheduleAppointmentByManagementToken,
  resolveAppointmentByManagementToken,
} from '../services/appointmentManagementTokenService.js';
import { formatZodError } from '../utils/validation.js';
import type { AppointmentRecord } from '../repositories/appointmentRepository.js';
import { trackServerError } from '../services/errorTrackingService.js';

export const publicAppointmentManagementRoutes = Router();

const manageRateLimit = createRequestRateLimit({
  keyPrefix: 'appointment-manage',
  maxRequests: 30,
  windowMs: 60_000,
});

publicAppointmentManagementRoutes.use(manageRateLimit);

function canManage(appointment: AppointmentRecord): boolean {
  return appointment.status !== 'cancelled' && appointment.appointment_at.getTime() > Date.now();
}

async function toAppointmentDetails(accountId: number, appointment: AppointmentRecord) {
  const [service, specialist] = await Promise.all([
    findService(accountId, appointment.service_id),
    findSpecialistByIdAnyAccount(appointment.specialist_id),
  ]);

  const manageable = canManage(appointment);

  return {
    status: appointment.status,
    scheduledAt: appointment.appointment_at.toISOString(),
    durationMin: appointment.duration_min,
    service: service?.name ?? '',
    specialist: specialist?.name ?? '',
    meeting: {
      provider: appointment.meeting_provider,
      ...(appointment.meeting_link ? { meetingUrl: appointment.meeting_link } : {}),
      ...(appointment.meeting_provider === 'offline' && appointment.location_address
        ? { location: appointment.location_address }
        : {}),
    },
    canCancel: manageable,
    canReschedule: manageable,
  };
}

function handleTokenError(error: unknown, req: import('express').Request, res: import('express').Response) {
  if (error instanceof AppointmentManagementTokenError) {
    return res.status(404).json({ code: 'not_found' });
  }
  void trackServerError({ method: req.method, path: req.path, error });
  res.locals.errorTracked = true;
  return res.status(500).json({ code: 'internal_error' });
}

publicAppointmentManagementRoutes.get('/:token', async (req, res) => {
  try {
    const { accountId, appointment } = await resolveAppointmentByManagementToken(req.params.token);
    return res.json(await toAppointmentDetails(accountId, appointment));
  } catch (error) {
    return handleTokenError(error, req, res);
  }
});

publicAppointmentManagementRoutes.post('/:token/cancel', async (req, res) => {
  try {
    const { accountId, appointment } = await resolveAppointmentByManagementToken(req.params.token);
    if (!canManage(appointment)) {
      return res.status(409).json({ code: 'not_manageable' });
    }
    const updated = await cancelAppointmentByManagementToken(req.params.token);
    return res.json(await toAppointmentDetails(accountId, updated));
  } catch (error) {
    return handleTokenError(error, req, res);
  }
});

publicAppointmentManagementRoutes.post('/:token/reschedule', async (req, res) => {
  const parsed = appointmentRescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const { accountId, appointment } = await resolveAppointmentByManagementToken(req.params.token);
    if (!canManage(appointment)) {
      return res.status(409).json({ code: 'not_manageable' });
    }
    const updated = await rescheduleAppointmentByManagementToken(req.params.token, parsed.data.scheduledAt);
    return res.json(await toAppointmentDetails(accountId, updated));
  } catch (error) {
    return handleTokenError(error, req, res);
  }
});
