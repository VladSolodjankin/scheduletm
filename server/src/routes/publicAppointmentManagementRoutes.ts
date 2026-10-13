import { Router } from 'express';
import { appointmentRescheduleSchema } from '../config/schemas.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';
import { findService } from '../repositories/serviceRepository.js';
import { findSpecialistByIdAnyAccount } from '../repositories/specialistRepository.js';
import { findWebUserById } from '../repositories/webUserRepository.js';
import { isClientRole } from '../policies/rolePermissions.js';
import { resolveUserByAccessToken } from '../services/authService.js';
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

/** True when the bearer token (if any) belongs to the client who owns this appointment, so the page can offer a link into the logged-in app instead of just the token flow. */
async function resolveCanOpenInApp(req: import('express').Request, appointment: AppointmentRecord): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return false;
  }

  const actor = await resolveUserByAccessToken(auth.slice('Bearer '.length));
  if (!actor || !isClientRole(actor.role) || actor.accountId !== appointment.account_id) {
    return false;
  }

  const webUser = await findWebUserById(actor.accountId, Number(actor.id));
  return webUser?.client_id === appointment.user_id;
}

async function toAppointmentDetails(
  accountId: number,
  appointment: AppointmentRecord,
  canOpenInApp: boolean,
) {
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
    canOpenInApp,
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
    const canOpenInApp = await resolveCanOpenInApp(req, appointment);
    return res.json(await toAppointmentDetails(accountId, appointment, canOpenInApp));
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
    const canOpenInApp = await resolveCanOpenInApp(req, appointment);
    const updated = await cancelAppointmentByManagementToken(req.params.token);
    return res.json(await toAppointmentDetails(accountId, updated, canOpenInApp));
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
    const canOpenInApp = await resolveCanOpenInApp(req, appointment);
    const updated = await rescheduleAppointmentByManagementToken(req.params.token, parsed.data.scheduledAt);
    return res.json(await toAppointmentDetails(accountId, updated, canOpenInApp));
  } catch (error) {
    return handleTokenError(error, req, res);
  }
});
