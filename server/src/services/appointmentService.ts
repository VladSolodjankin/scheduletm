import { getDefaultAccountId } from '../repositories/accountRepository.js';
import {
  type AppointmentRecord,
  type AppointmentStatus,
  createAppointment,
  ensureFallbackClientForAccount,
  ensureFallbackServiceForAccount,
  findAppointmentById,
  listAppointments,
  updateAppointment,
} from '../repositories/appointmentRepository.js';
import {
  findSpecialistById,
  findSpecialistByWebUserId,
  listSpecialistsByAccount,
  type SpecialistRecord,
} from '../repositories/specialistRepository.js';
import { listExternalBusySlots, type ExternalBusySlot } from './calendarAvailabilityService.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';

type AppointmentDto = {
  id: number;
  specialistId: number;
  scheduledAt: string;
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
};

type AppointmentListResult = {
  appointments: AppointmentDto[];
  specialists: Array<{ id: number; name: string; timezone: string }>;
  busySlots: ExternalBusySlot[];
};

type CreateAppointmentPayload = {
  specialistId: number;
  scheduledAt: string;
  status?: AppointmentStatus;
  meetingLink?: string;
  notes?: string;
};

type UpdateAppointmentPayload = {
  scheduledAt?: string;
  status?: AppointmentStatus;
  meetingLink?: string;
  notes?: string;
};

function canManageAllAppointments(role: WebUserRole): boolean {
  return role === WebUserRole.Owner || role === WebUserRole.Admin;
}

function parseMeetingLinkFromNotes(notes: string | null): { notes: string; meetingLink: string } {
  if (!notes) {
    return { notes: '', meetingLink: '' };
  }

  const [firstLine, ...restLines] = notes.split('\n');
  const prefix = 'meetingLink: ';

  if (!firstLine.startsWith(prefix)) {
    return { notes, meetingLink: '' };
  }

  return {
    meetingLink: firstLine.slice(prefix.length).trim(),
    notes: restLines.join('\n').trim(),
  };
}

function composeNotes(meetingLink: string | undefined, notes: string | undefined): string | null {
  const normalizedMeetingLink = meetingLink?.trim() ?? '';
  const normalizedNotes = notes?.trim() ?? '';

  if (!normalizedMeetingLink && !normalizedNotes) {
    return null;
  }

  if (!normalizedMeetingLink) {
    return normalizedNotes;
  }

  return [`meetingLink: ${normalizedMeetingLink}`, normalizedNotes].filter(Boolean).join('\n');
}

function mapAppointment(row: AppointmentRecord): AppointmentDto {
  const parsed = parseMeetingLinkFromNotes(row.comment);

  return {
    id: row.id,
    specialistId: row.specialist_id,
    scheduledAt: row.appointment_at.toISOString(),
    status: row.status,
    notes: parsed.notes,
    meetingLink: parsed.meetingLink,
  };
}

async function resolveAccountId(actor: User): Promise<number> {
  if (actor.accountId) {
    return actor.accountId;
  }

  return getDefaultAccountId();
}

async function resolveAllowedSpecialistId(actor: User, accountId: number): Promise<number | null> {
  if (canManageAllAppointments(actor.role)) {
    return null;
  }

  const specialist = await findSpecialistByWebUserId(accountId, Number(actor.id));
  if (!specialist) {
    throw new Error('SPECIALIST_PROFILE_NOT_FOUND');
  }

  return specialist.id;
}

function mapSpecialistsForUi(rows: SpecialistRecord[]) {
  return rows.map((item) => ({
    id: item.id,
    name: item.name,
    timezone: item.timezone || 'UTC',
  }));
}

export async function getAppointments(
  actor: User,
  filters: { from?: string; to?: string; specialistId?: number },
): Promise<AppointmentListResult> {
  const accountId = await resolveAccountId(actor);
  const allowedSpecialistId = await resolveAllowedSpecialistId(actor, accountId);

  const specialistId = allowedSpecialistId ?? filters.specialistId;

  const items = await listAppointments({
    accountId,
    specialistId,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  });

  const specialists = canManageAllAppointments(actor.role)
    ? mapSpecialistsForUi(await listSpecialistsByAccount(accountId))
    : mapSpecialistsForUi(
        (await listSpecialistsByAccount(accountId)).filter((item) => item.user_id === Number(actor.id)),
      );

  const fromDate = filters.from ? new Date(filters.from) : new Date();
  const toDate = filters.to ? new Date(filters.to) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const busySpecialistIds = specialistId
    ? [specialistId]
    : specialists.map((specialist) => specialist.id);

  const busySlots = await listExternalBusySlots({
    accountId,
    specialistIds: busySpecialistIds,
    from: fromDate,
    to: toDate,
  });

  return {
    appointments: items.map(mapAppointment),
    specialists,
    busySlots,
  };
}

export async function createAppointmentForActor(
  actor: User,
  payload: CreateAppointmentPayload,
): Promise<AppointmentDto> {
  const accountId = await resolveAccountId(actor);

  if (!canManageAllAppointments(actor.role)) {
    const selfSpecialist = await findSpecialistByWebUserId(accountId, Number(actor.id));
    if (!selfSpecialist || selfSpecialist.id !== payload.specialistId) {
      throw new Error('FORBIDDEN_SPECIALIST');
    }
  }

  const specialist = await findSpecialistById(accountId, payload.specialistId);
  if (!specialist) {
    throw new Error('SPECIALIST_NOT_FOUND');
  }

  const [userId, serviceId] = await Promise.all([
    ensureFallbackClientForAccount(accountId),
    ensureFallbackServiceForAccount(accountId),
  ]);

  const created = await createAppointment({
    accountId,
    specialistId: payload.specialistId,
    scheduledAt: new Date(payload.scheduledAt),
    status: payload.status ?? 'new',
    notes: composeNotes(payload.meetingLink, payload.notes),
    userId,
    serviceId,
    durationMin: 60,
  });

  return mapAppointment(created);
}

export async function updateAppointmentForActor(
  actor: User,
  appointmentId: number,
  payload: UpdateAppointmentPayload,
): Promise<AppointmentDto | null> {
  const accountId = await resolveAccountId(actor);
  const existing = await findAppointmentById(accountId, appointmentId);

  if (!existing) {
    return null;
  }

  if (!canManageAllAppointments(actor.role)) {
    const selfSpecialist = await findSpecialistByWebUserId(accountId, Number(actor.id));
    if (!selfSpecialist || selfSpecialist.id !== existing.specialist_id) {
      throw new Error('FORBIDDEN_SPECIALIST');
    }
  }

  const updated = await updateAppointment({
    accountId,
    id: appointmentId,
    scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
    status: payload.status,
    notes: Object.prototype.hasOwnProperty.call(payload, 'notes') || Object.prototype.hasOwnProperty.call(payload, 'meetingLink')
      ? composeNotes(payload.meetingLink, payload.notes)
      : undefined,
  });

  return updated ? mapAppointment(updated) : null;
}

export async function cancelAppointmentForActor(actor: User, appointmentId: number): Promise<AppointmentDto | null> {
  return updateAppointmentForActor(actor, appointmentId, { status: 'cancelled' });
}

export async function rescheduleAppointmentForActor(
  actor: User,
  appointmentId: number,
  scheduledAt: string,
): Promise<AppointmentDto | null> {
  return updateAppointmentForActor(actor, appointmentId, { scheduledAt });
}
