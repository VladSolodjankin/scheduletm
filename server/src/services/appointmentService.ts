import {
  createAppointmentAuditEvent,
  type AppointmentRecord,
  type AppointmentAuditAction,
  type AppointmentStatus,
  createAppointment,
  ensureFallbackServiceForAccount,
  findAppointmentById,
  findAppointmentByIdAnyAccount,
  listAppointmentEventsByAppointmentIds,
  listAppointments,
  listAppointmentsAllAccounts,
  updateAppointment,
} from '../repositories/appointmentRepository.js';
import {
  createClient,
  findClientByContact,
  findClientById,
  listClientsByAccount,
  type ClientRecord,
  updateClientById,
} from '../repositories/clientRepository.js';
import {
  findSpecialistById,
  findSpecialistByIdAnyAccount,
  findSpecialistByWebUserId,
  listSpecialistsAllAccounts,
  listSpecialistsByAccount,
  type SpecialistRecord,
} from '../repositories/specialistRepository.js';
import { findWebUserById } from '../repositories/webUserRepository.js';
import { listExternalBusySlots, type ExternalBusySlot } from './calendarAvailabilityService.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { canCreateAppointments, canManageAllAppointments, canMarkPaidAndNotify, isClientRole } from '../policies/rolePermissions.js';
import { sendAppointmentNotificationByType } from './appointmentNotificationService.js';

type AppointmentClientDto = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

type AppointmentDto = {
  id: number;
  specialistId: number;
  scheduledAt: string;
  durationMin: number;
  status: AppointmentStatus;
  paymentStatus: 'paid' | 'unpaid';
  meetingLink: string;
  notes: string;
  client: AppointmentClientDto;
  events: AppointmentEventDto[];
};

type AppointmentEventDto = {
  action: AppointmentAuditAction;
  createdAt: string;
};

type AppointmentListResult = {
  appointments: AppointmentDto[];
  specialists: Array<{ id: number; name: string; timezone: string; slotStepMin: number }>;
  clients: AppointmentClientDto[];
  busySlots: ExternalBusySlot[];
};

type AppointmentClientPayload = {
  clientId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
};

type CreateAppointmentPayload = {
  specialistId: number;
  appointmentAt: string;
  appointmentEndAt: string;
  status?: AppointmentStatus;
  meetingLink?: string;
  notes?: string;
} & AppointmentClientPayload;

type UpdateAppointmentPayload = {
  appointmentAt?: string;
  appointmentEndAt?: string;
  durationMin?: number;
  status?: AppointmentStatus;
  meetingLink?: string;
  notes?: string;
} & AppointmentClientPayload;

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

function mapClient(row: ClientRecord): AppointmentClientDto {
  return {
    id: row.id,
    username: row.username ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
  };
}

function mapAppointment(row: AppointmentRecord): AppointmentDto {
  const parsed = parseMeetingLinkFromNotes(row.comment);

  return {
    id: row.id,
    specialistId: row.specialist_id,
    scheduledAt: row.appointment_at.toISOString(),
    durationMin: row.duration_min,
    status: row.status,
    paymentStatus: row.is_paid ? 'paid' : 'unpaid',
    notes: parsed.notes,
    meetingLink: parsed.meetingLink,
    client: {
      id: row.user_id,
      username: row.client_username ?? '',
      firstName: row.client_first_name ?? '',
      lastName: row.client_last_name ?? '',
      phone: row.client_phone ?? '',
      email: row.client_email ?? '',
    },
    events: [],
  };
}

function mapEventsByAppointmentId(
  rows: Awaited<ReturnType<typeof listAppointmentEventsByAppointmentIds>>,
): Map<number, AppointmentEventDto[]> {
  const eventsById = new Map<number, AppointmentEventDto[]>();

  for (const row of rows) {
    const events = eventsById.get(row.appointment_id) ?? [];
    events.push({
      action: row.action,
      createdAt: row.created_at.toISOString(),
    });
    eventsById.set(row.appointment_id, events);
  }

  return eventsById;
}

async function resolveAccountId(actor: User): Promise<number> {
  return actor.accountId;
}

async function resolveAllowedSpecialistId(actor: User, accountId: number): Promise<number | null> {
  if (canManageAllAppointments(actor.role)) {
    return null;
  }
  if (isClientRole(actor.role)) {
    return null;
  }

  const specialist = await findSpecialistByWebUserId(accountId, Number(actor.id));
  if (!specialist) {
    throw new Error('SPECIALIST_PROFILE_NOT_FOUND');
  }

  return specialist.id;
}

async function resolveClientScope(actor: User, accountId: number): Promise<number | null> {
  if (!isClientRole(actor.role)) {
    return null;
  }

  const webUser = await findWebUserById(accountId, Number(actor.id));
  if (!webUser?.client_id) {
    throw new Error('CLIENT_PROFILE_NOT_FOUND');
  }

  return webUser.client_id;
}

function mapSpecialistsForUi(rows: SpecialistRecord[]) {
  return rows.map((item) => ({
    id: item.id,
    name: item.name,
    timezone: item.timezone || 'UTC',
    slotStepMin: item.slot_step_min ?? 30,
  }));
}

function toTimeRange(scheduledAtIso: string, durationMin: number) {
  const start = new Date(scheduledAtIso).getTime();
  const end = start + durationMin * 60 * 1000;

  return { start, end };
}

function intersectsByTime(
  left: { scheduledAt: string; durationMin: number },
  right: { scheduledAt: string; durationMin: number },
) {
  const leftRange = toTimeRange(left.scheduledAt, left.durationMin);
  const rightRange = toTimeRange(right.scheduledAt, right.durationMin);

  return leftRange.start < rightRange.end && rightRange.start < leftRange.end;
}

function filterBusySlotsOverlappingAppointments(
  appointments: AppointmentDto[],
  busySlots: ExternalBusySlot[],
): ExternalBusySlot[] {
  const appointmentsBySpecialist = new Map<number, AppointmentDto[]>();

  for (const appointment of appointments) {
    const list = appointmentsBySpecialist.get(appointment.specialistId) ?? [];
    list.push(appointment);
    appointmentsBySpecialist.set(appointment.specialistId, list);
  }

  return busySlots.filter((busySlot) => {
    const specialistAppointments = appointmentsBySpecialist.get(busySlot.specialistId) ?? [];

    return !specialistAppointments.some((appointment) => intersectsByTime(appointment, busySlot));
  });
}

function resolveDurationFromRange(appointmentAt: string, appointmentEndAt: string): number {
  const start = new Date(appointmentAt).getTime();
  const end = new Date(appointmentEndAt).getTime();

  return Math.round((end - start) / 60_000);
}

async function resolveClientId(accountId: number, payload: AppointmentClientPayload): Promise<number> {
  if (payload.clientId) {
    const existing = await findClientById(accountId, payload.clientId);
    if (!existing) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    if (payload.firstName && payload.lastName) {
      await updateClientById(accountId, payload.clientId, {
        accountId,
        username: payload.username,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        email: payload.email,
      });
    }

    return existing.id;
  }

  if (!payload.firstName || !payload.lastName) {
    throw new Error('CLIENT_NAME_REQUIRED');
  }

  const matched = await findClientByContact(accountId, {
    username: payload.username,
    phone: payload.phone,
    email: payload.email,
  });

  if (matched) {
    await updateClientById(accountId, matched.id, {
      accountId,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
    });
    return matched.id;
  }

  const created = await createClient({
    accountId,
    username: payload.username,
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    email: payload.email,
  });

  return created.id;
}

export async function getAppointments(
  actor: User,
  filters: { from?: string; to?: string; specialistId?: number },
): Promise<AppointmentListResult> {
  const accountId = await resolveAccountId(actor);
  const allowedSpecialistId = await resolveAllowedSpecialistId(actor, accountId);
  const allowedClientId = await resolveClientScope(actor, accountId);

  const specialistId = allowedSpecialistId ?? filters.specialistId;

  const listFilters = {
    specialistId,
    clientId: allowedClientId ?? undefined,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  };
  const items = actor.role === WebUserRole.Owner
    ? await listAppointmentsAllAccounts(listFilters)
    : await listAppointments({
      accountId,
      ...listFilters,
    });

  const allSpecialists = actor.role === WebUserRole.Owner
    ? await listSpecialistsAllAccounts()
    : await listSpecialistsByAccount(accountId);

  const specialists = canManageAllAppointments(actor.role)
    ? mapSpecialistsForUi(allSpecialists)
    : isClientRole(actor.role)
      ? mapSpecialistsForUi(
        allSpecialists.filter((item) =>
          items.some((appointment) => appointment.specialist_id === item.id),
        ),
      )
      : mapSpecialistsForUi(
        allSpecialists.filter((item) => item.user_id === Number(actor.id)),
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
  const appointmentsForUi = items.map(mapAppointment);
  const eventsByAppointmentId = mapEventsByAppointmentId(
    await listAppointmentEventsByAppointmentIds(
      accountId,
      appointmentsForUi.map((item) => item.id),
    ),
  );

  return {
    appointments: appointmentsForUi.map((item) => ({
      ...item,
      events: eventsByAppointmentId.get(item.id) ?? [],
    })),
    specialists,
    clients: isClientRole(actor.role)
      ? (await listClientsByAccount(accountId))
        .filter((client) => client.id === allowedClientId)
        .map(mapClient)
      : (await listClientsByAccount(accountId)).map(mapClient),
    busySlots: filterBusySlotsOverlappingAppointments(appointmentsForUi, busySlots),
  };
}

export async function createAppointmentForActor(
  actor: User,
  payload: CreateAppointmentPayload,
): Promise<AppointmentDto> {
  if (!canCreateAppointments(actor.role)) {
    throw new Error('FORBIDDEN_CLIENT');
  }

  const accountId = await resolveAccountId(actor);

  if (!canManageAllAppointments(actor.role) && !isClientRole(actor.role)) {
    const selfSpecialist = await findSpecialistByWebUserId(accountId, Number(actor.id));
    if (!selfSpecialist || selfSpecialist.id !== payload.specialistId) {
      throw new Error('FORBIDDEN_SPECIALIST');
    }
  }

  const specialist = actor.role === WebUserRole.Owner
    ? await findSpecialistByIdAnyAccount(payload.specialistId)
    : await findSpecialistById(accountId, payload.specialistId);
  if (!specialist) {
    throw new Error('SPECIALIST_NOT_FOUND');
  }

  const [userId, serviceId] = await Promise.all([
    isClientRole(actor.role) ? resolveClientScope(actor, accountId) : resolveClientId(accountId, payload),
    ensureFallbackServiceForAccount(accountId),
  ]);
  if (!userId) {
    throw new Error('CLIENT_PROFILE_NOT_FOUND');
  }

  const created = await createAppointment({
    accountId,
    specialistId: payload.specialistId,
    scheduledAt: new Date(payload.appointmentAt),
    status: payload.status ?? 'new',
    notes: composeNotes(payload.meetingLink, payload.notes),
    userId,
    serviceId,
    durationMin: resolveDurationFromRange(payload.appointmentAt, payload.appointmentEndAt),
  });

  const rows = await listAppointments({ accountId, specialistId: created.specialist_id });
  const hydrated = rows.find((item) => item.id === created.id) ?? created;

  await sendAppointmentNotificationByType({
    accountId,
    appointment: hydrated,
    notificationType: 'appointment_created',
  }).catch(() => undefined);

  return mapAppointment(hydrated);
}

async function resolveManagedAppointment(actor: User, appointmentId: number) {
  const accountId = await resolveAccountId(actor);
  const existing = actor.role === WebUserRole.Owner
    ? await findAppointmentByIdAnyAccount(appointmentId)
    : await findAppointmentById(accountId, appointmentId);

  if (!existing) {
    return { accountId, existing: null };
  }

  if (!canManageAllAppointments(actor.role)) {
    if (isClientRole(actor.role)) {
      const allowedClientId = await resolveClientScope(actor, accountId);
      if (!allowedClientId || existing.user_id !== allowedClientId) {
        throw new Error('FORBIDDEN_CLIENT');
      }

      return { accountId, existing };
    }

    const selfSpecialist = await findSpecialistByWebUserId(accountId, Number(actor.id));
    if (!selfSpecialist || selfSpecialist.id !== existing.specialist_id) {
      throw new Error('FORBIDDEN_SPECIALIST');
    }
  }

  return { accountId, existing };
}

async function appendAuditEvent(
  accountId: number,
  appointmentId: number,
  actor: User,
  action: AppointmentAuditAction,
  metadata?: Record<string, unknown>,
) {
  await createAppointmentAuditEvent({
    accountId,
    appointmentId,
    action,
    actorWebUserId: Number.isFinite(Number(actor.id)) ? Number(actor.id) : null,
    metadata,
  });
}

export async function updateAppointmentForActor(
  actor: User,
  appointmentId: number,
  payload: UpdateAppointmentPayload,
): Promise<AppointmentDto | null> {
  const { accountId, existing } = await resolveManagedAppointment(actor, appointmentId);

  if (!existing) {
    return null;
  }

  const appointmentAt = payload.appointmentAt;
  const appointmentEndAt = payload.appointmentEndAt;
  const durationMin = appointmentAt && appointmentEndAt
    ? resolveDurationFromRange(appointmentAt, appointmentEndAt)
    : payload.durationMin;

  const userId = payload.clientId || payload.firstName || payload.lastName || payload.username || payload.phone || payload.email
    ? await resolveClientId(accountId, payload)
    : undefined;

  const updated = await updateAppointment({
    accountId,
    id: appointmentId,
    scheduledAt: appointmentAt ? new Date(appointmentAt) : undefined,
    durationMin,
    status: payload.status,
    userId,
    notes: Object.prototype.hasOwnProperty.call(payload, 'notes') || Object.prototype.hasOwnProperty.call(payload, 'meetingLink')
      ? composeNotes(payload.meetingLink, payload.notes)
      : undefined,
  });

  if (!updated) {
    return null;
  }

  const rows = await listAppointments({ accountId, specialistId: updated.specialist_id });
  const hydrated = rows.find((item) => item.id === updated.id) ?? updated;

  return mapAppointment(hydrated);
}

export async function cancelAppointmentForActor(actor: User, appointmentId: number): Promise<AppointmentDto | null> {
  const updated = await updateAppointmentForActor(actor, appointmentId, { status: 'cancelled' });

  if (!updated) {
    return null;
  }

  const accountId = await resolveAccountId(actor);
  await appendAuditEvent(accountId, appointmentId, actor, 'cancel');

  return updated;
}

export async function rescheduleAppointmentForActor(
  actor: User,
  appointmentId: number,
  scheduledAt: string,
): Promise<AppointmentDto | null> {
  const { existing } = await resolveManagedAppointment(actor, appointmentId);
  if (!existing) {
    return null;
  }

  const updated = await updateAppointmentForActor(actor, appointmentId, {
    appointmentAt: scheduledAt,
    appointmentEndAt: new Date(new Date(scheduledAt).getTime() + existing.duration_min * 60_000).toISOString(),
  });

  if (!updated) {
    return null;
  }

  const accountId = await resolveAccountId(actor);
  await appendAuditEvent(accountId, appointmentId, actor, 'reschedule', { scheduledAt });

  return updated;
}

export async function markPaidAppointmentForActor(actor: User, appointmentId: number): Promise<AppointmentDto | null> {
  if (!canMarkPaidAndNotify(actor.role)) {
    throw new Error('FORBIDDEN_CLIENT');
  }

  const { accountId, existing } = await resolveManagedAppointment(actor, appointmentId);

  if (!existing) {
    return null;
  }

  const updated = await updateAppointment({
    accountId,
    id: appointmentId,
    isPaid: true,
  });

  if (!updated) {
    return null;
  }

  await appendAuditEvent(accountId, appointmentId, actor, 'mark-paid');

  const rows = await listAppointments({ accountId, specialistId: updated.specialist_id });
  const hydrated = rows.find((item) => item.id === updated.id) ?? updated;

  return mapAppointment(hydrated);
}

export async function notifyAppointmentForActor(actor: User, appointmentId: number): Promise<AppointmentDto | null> {
  if (!canMarkPaidAndNotify(actor.role)) {
    throw new Error('FORBIDDEN_CLIENT');
  }

  const { accountId, existing } = await resolveManagedAppointment(actor, appointmentId);

  if (!existing) {
    return null;
  }

  const client = await findClientById(accountId, existing.user_id);
  const delivered = await sendAppointmentNotificationByType({
    accountId,
    appointment: {
      ...existing,
      client_first_name: client?.first_name ?? existing.client_first_name,
      client_last_name: client?.last_name ?? existing.client_last_name,
      client_username: client?.username ?? existing.client_username,
      client_telegram_id: client?.telegram_id ?? existing.client_telegram_id,
      client_email: client?.email ?? existing.client_email,
    },
    notificationType: 'appointment_reminder',
    force: true,
  });

  if (!delivered.delivered) {
    throw new Error('NOTIFICATION_DELIVERY_FAILED');
  }

  await appendAuditEvent(accountId, appointmentId, actor, 'notify');

  const rows = await listAppointments({ accountId, specialistId: existing.specialist_id });
  const hydrated = rows.find((item) => item.id === existing.id);

  return mapAppointment(hydrated ?? existing);
}
