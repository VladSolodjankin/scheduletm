import { env } from '../config/env.js';
import {
  createAppointmentAuditEvent,
  findAppointmentByIdAnyAccount,
  listAppointments,
  updateAppointment,
  type AppointmentRecord,
} from '../repositories/appointmentRepository.js';
import {
  createAppointmentManagementToken,
  findActiveAppointmentManagementToken,
  findValidAppointmentManagementToken,
} from '../repositories/appointmentManagementTokenRepository.js';
import { enqueueTrackedAppointmentNotification } from './notificationDeliveryService.js';

const MANAGE_URL_TTL_AFTER_APPOINTMENT_MS = 7 * 24 * 60 * 60 * 1000;

export class AppointmentManagementTokenError extends Error {
  constructor(public readonly code: 'TOKEN_INVALID') {
    super(code);
  }
}

function buildManageUrl(token: string): string {
  return `${env.EMAIL_VERIFY_BASE_URL.replace(/\/+$/, '')}/appointments/manage/${encodeURIComponent(token)}`;
}

export async function getOrCreateAppointmentManageUrl(appointment: AppointmentRecord): Promise<string> {
  const existing = await findActiveAppointmentManagementToken(appointment.id);
  if (existing) {
    return buildManageUrl(existing.token);
  }

  const expiresAt = new Date(
    Math.max(appointment.appointment_at.getTime(), Date.now()) + MANAGE_URL_TTL_AFTER_APPOINTMENT_MS,
  );
  const created = await createAppointmentManagementToken(appointment.id, expiresAt);
  return buildManageUrl(created.token);
}

export async function resolveAppointmentByManagementToken(
  token: string,
): Promise<{ accountId: number; appointment: AppointmentRecord }> {
  const tokenRecord = await findValidAppointmentManagementToken(token);
  if (!tokenRecord) {
    throw new AppointmentManagementTokenError('TOKEN_INVALID');
  }

  const appointment = await findAppointmentByIdAnyAccount(tokenRecord.appointment_id);
  if (!appointment) {
    throw new AppointmentManagementTokenError('TOKEN_INVALID');
  }

  return { accountId: appointment.account_id, appointment };
}

async function rehydrate(appointment: AppointmentRecord): Promise<AppointmentRecord> {
  const rows = await listAppointments({ accountId: appointment.account_id, specialistId: appointment.specialist_id });
  return rows.find((row) => row.id === appointment.id) ?? appointment;
}

export async function cancelAppointmentByManagementToken(token: string): Promise<AppointmentRecord> {
  const { accountId, appointment } = await resolveAppointmentByManagementToken(token);

  const updated = await updateAppointment({ accountId, id: appointment.id, status: 'cancelled' });
  if (!updated) {
    throw new AppointmentManagementTokenError('TOKEN_INVALID');
  }

  await createAppointmentAuditEvent({
    accountId,
    appointmentId: appointment.id,
    action: 'cancel',
    actorWebUserId: null,
    metadata: { via: 'magic_link' },
  });

  const hydrated = await rehydrate(updated);
  await enqueueTrackedAppointmentNotification({ appointment: hydrated, notificationType: 'appointment_cancelled' });

  return hydrated;
}

export async function rescheduleAppointmentByManagementToken(
  token: string,
  scheduledAt: string,
): Promise<AppointmentRecord> {
  const { accountId, appointment } = await resolveAppointmentByManagementToken(token);

  const updated = await updateAppointment({
    accountId,
    id: appointment.id,
    scheduledAt: new Date(scheduledAt),
  });
  if (!updated) {
    throw new AppointmentManagementTokenError('TOKEN_INVALID');
  }

  await createAppointmentAuditEvent({
    accountId,
    appointmentId: appointment.id,
    action: 'reschedule',
    actorWebUserId: null,
    metadata: { via: 'magic_link', scheduledAt },
  });

  const hydrated = await rehydrate(updated);
  await enqueueTrackedAppointmentNotification({ appointment: hydrated, notificationType: 'appointment_changed' });

  return hydrated;
}
