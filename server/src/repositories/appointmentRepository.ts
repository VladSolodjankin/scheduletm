import { db } from '../db/knex.js';
import { enqueueGoogleCalendarSync, enqueueGoogleCalendarUpserts } from './googleCalendarSyncRepository.js';

export type AppointmentStatus = 'new' | 'confirmed' | 'cancelled';
export type AppointmentAuditAction = 'cancel' | 'reschedule' | 'mark-paid' | 'mark-unpaid' | 'payment-received' | 'notify';

export type AppointmentRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  appointment_at: Date;
  status: AppointmentStatus;
  comment: string | null;
  meeting_link: string | null;
  meeting_provider: 'manual' | 'zoom' | 'yandex_telemost' | 'offline';
  location_address: string | null;
  zoom_meeting_id: string | null;
  zoom_meeting_started_at: Date | null;
  zoom_meeting_ended_at: Date | null;
  duration_min: number;
  is_paid: boolean;
  price: number;
  currency: string;
  user_id: number;
  service_id: number;
  group_id?: number | null;
  google_event_id?: string | null;
  google_event_web_user_id?: number | null;
  created_at: Date;
  updated_at: Date;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_username?: string | null;
  client_telegram_id?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
};

export type AppointmentAuditEventRecord = {
  id: number;
  account_id: number;
  appointment_id: number;
  action: AppointmentAuditAction;
  actor_web_user_id: number | null;
  metadata_json: string | null;
  created_at: Date;
  actor_role?: string | null;
  actor_first_name?: string | null;
  actor_last_name?: string | null;
  actor_email?: string | null;
};

type AppointmentEventsFilters = {
  actions?: AppointmentAuditAction[];
  actorWebUserId?: number;
  from?: Date;
  to?: Date;
  limit?: number;
};

type AppointmentListFilters = {
  accountId: number;
  from?: Date;
  to?: Date;
  specialistId?: number;
  clientId?: number;
};

type CreateAppointmentInput = {
  accountId: number;
  specialistId: number;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  meetingLink?: string | null;
  meetingProvider?: 'manual' | 'zoom' | 'yandex_telemost' | 'offline';
  locationAddress?: string | null;
  zoomMeetingId?: string | null;
  userId: number;
  serviceId: number;
  durationMin: number;
  /** Price snapshot (whole units) copied from the service at creation time. */
  price?: number;
  currency?: string;
};

export class AppointmentRepositoryError extends Error {
  constructor(public readonly code: 'SLOT_CONFLICT') {
    super(code);
  }
}

function isSlotConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01';
}

type UpdateAppointmentInput = {
  accountId: number;
  id: number;
  scheduledAt?: Date;
  status?: AppointmentStatus;
  notes?: string | null;
  meetingLink?: string | null;
  meetingProvider?: 'manual' | 'zoom' | 'yandex_telemost' | 'offline';
  locationAddress?: string | null;
  durationMin?: number;
  isPaid?: boolean;
  userId?: number;
  zoomMeetingStartedAt?: Date;
  zoomMeetingEndedAt?: Date;
};

export async function listAppointments(filters: AppointmentListFilters): Promise<AppointmentRecord[]> {
  const query = db('appointments')
    .leftJoin('clients', 'clients.id', 'appointments.user_id')
    .where({ 'appointments.account_id': filters.accountId })
    .orderBy('appointment_at', 'asc');

  if (filters.specialistId) {
    query.andWhere('appointments.specialist_id', filters.specialistId);
  }

  if (filters.clientId) {
    query.andWhere('appointments.user_id', filters.clientId);
  }

  if (filters.from) {
    query.andWhere('appointments.appointment_at', '>=', filters.from);
  }

  if (filters.to) {
    query.andWhere('appointments.appointment_at', '<=', filters.to);
  }

  return query.select<AppointmentRecord[]>(
    'appointments.*',
    'clients.first_name as client_first_name',
    'clients.last_name as client_last_name',
    'clients.username as client_username',
    'clients.telegram_id as client_telegram_id',
    'clients.phone as client_phone',
    'clients.email as client_email',
  );
}

export async function findAppointmentById(accountId: number, id: number): Promise<AppointmentRecord | null> {
  const row = await db('appointments')
    .where({ account_id: accountId, id })
    .first<AppointmentRecord>();

  return row ?? null;
}

export async function findAppointmentByIdAnyAccount(id: number): Promise<AppointmentRecord | null> {
  const row = await db('appointments')
    .where({ id })
    .first<AppointmentRecord>();

  return row ?? null;
}

export async function findAppointmentByZoomMeetingIdAnyAccount(zoomMeetingId: string): Promise<AppointmentRecord | null> {
  const row = await db('appointments')
    .where({ zoom_meeting_id: zoomMeetingId })
    .orderBy('id', 'desc')
    .first<AppointmentRecord>();

  return row ?? null;
}

export async function listAppointmentsAllAccounts(filters: Omit<AppointmentListFilters, 'accountId'>): Promise<AppointmentRecord[]> {
  const query = db('appointments')
    .leftJoin('clients', function joinClients() {
      this.on('clients.id', '=', 'appointments.user_id').andOn('clients.account_id', '=', 'appointments.account_id');
    })
    .orderBy('appointment_at', 'asc');

  if (filters.specialistId) {
    query.andWhere('appointments.specialist_id', filters.specialistId);
  }

  if (filters.clientId) {
    query.andWhere('appointments.user_id', filters.clientId);
  }

  if (filters.from) {
    query.andWhere('appointments.appointment_at', '>=', filters.from);
  }

  if (filters.to) {
    query.andWhere('appointments.appointment_at', '<=', filters.to);
  }

  return query.select<AppointmentRecord[]>(
    'appointments.*',
    'clients.first_name as client_first_name',
    'clients.last_name as client_last_name',
    'clients.username as client_username',
    'clients.telegram_id as client_telegram_id',
    'clients.phone as client_phone',
    'clients.email as client_email',
  );
}

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord> {
  try {
    const [row] = await db('appointments')
      .insert({
        account_id: input.accountId,
        specialist_id: input.specialistId,
        appointment_at: input.scheduledAt,
        status: input.status,
        comment: input.notes,
        meeting_link: input.meetingLink ?? null,
        meeting_provider: input.meetingProvider ?? 'manual',
        location_address: input.locationAddress ?? null,
        zoom_meeting_id: input.zoomMeetingId ?? null,
        user_id: input.userId,
        service_id: input.serviceId,
        duration_min: input.durationMin,
        is_first_time: false,
        price: input.price ?? 0,
        currency: input.currency ?? 'RUB',
        is_paid: false,
      })
      .returning<AppointmentRecord[]>('*');

    if (row.status !== 'cancelled') {
      await enqueueGoogleCalendarSync({
        accountId: row.account_id,
        appointmentId: row.id,
        action: 'upsert',
        specialistId: row.specialist_id,
      });
    }

    return row;
  } catch (error) {
    if (isSlotConflict(error)) throw new AppointmentRepositoryError('SLOT_CONFLICT');
    throw error;
  }
}

export async function createAppointmentSeries(input: CreateAppointmentInput & {
  scheduledDates: Date[];
}): Promise<{ groupId: number; appointments: AppointmentRecord[] }> {
  try {
    return await db.transaction(async (trx) => {
      const [group] = await trx('appointment_groups').insert({
        account_id: input.accountId,
        user_id: input.userId,
        service_id: input.serviceId,
        specialist_id: input.specialistId,
        total_sessions: input.scheduledDates.length,
      }).returning<{ id: number }[]>('id');

      const appointments = await trx('appointments').insert(
        input.scheduledDates.map((scheduledAt) => ({
          account_id: input.accountId,
          specialist_id: input.specialistId,
          appointment_at: scheduledAt,
          status: input.status,
          comment: input.notes,
          meeting_link: input.meetingLink ?? null,
          meeting_provider: input.meetingProvider ?? 'manual',
          location_address: input.locationAddress ?? null,
          zoom_meeting_id: input.zoomMeetingId ?? null,
          user_id: input.userId,
          service_id: input.serviceId,
          group_id: group.id,
          duration_min: input.durationMin,
          is_first_time: false,
          price: input.price ?? 0,
          currency: input.currency ?? 'RUB',
          is_paid: false,
        })),
      ).returning<AppointmentRecord[]>('*');

      if (input.status !== 'cancelled') {
        await enqueueGoogleCalendarUpserts({
          accountId: input.accountId,
          specialistId: input.specialistId,
          appointmentIds: appointments.map((appointment) => appointment.id),
        }, trx);
      }

      return { groupId: group.id, appointments };
    });
  } catch (error) {
    if (isSlotConflict(error)) throw new AppointmentRepositoryError('SLOT_CONFLICT');
    throw error;
  }
}

export async function updateAppointment(input: UpdateAppointmentInput): Promise<AppointmentRecord | null> {
  const payload: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.scheduledAt) {
    payload.appointment_at = input.scheduledAt;
  }

  if (input.status) {
    payload.status = input.status;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
    payload.comment = input.notes;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'meetingLink')) {
    payload.meeting_link = input.meetingLink;
  }

  if (input.meetingProvider !== undefined) {
    payload.meeting_provider = input.meetingProvider;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'locationAddress')) {
    payload.location_address = input.locationAddress;
  }

  if (input.zoomMeetingStartedAt !== undefined) {
    payload.zoom_meeting_started_at = input.zoomMeetingStartedAt;
  }

  if (input.zoomMeetingEndedAt !== undefined) {
    payload.zoom_meeting_ended_at = input.zoomMeetingEndedAt;
  }

  if (input.durationMin !== undefined) {
    payload.duration_min = input.durationMin;
  }

  if (input.isPaid !== undefined) {
    payload.is_paid = input.isPaid;
  }

  if (input.userId !== undefined) {
    payload.user_id = input.userId;
  }

  const applyUpdate = (executor: typeof db) => executor('appointments')
    .where({ account_id: input.accountId, id: input.id })
    .update(payload)
    .returning<AppointmentRecord[]>('*');

  let row: AppointmentRecord | undefined;
  if (input.isPaid === true) {
    // Manual "paid": open online checkouts are cancelled in the same transaction, so a later payment on an
    // old link is recorded as 'duplicate' (visible) instead of being silently accepted twice.
    row = await db.transaction(async (trx) => {
      const [updated] = await applyUpdate(trx as unknown as typeof db);
      if (updated) {
        await trx('payment_orders')
          .where({ account_id: input.accountId, appointment_id: input.id, status: 'pending' })
          .update({ status: 'cancelled' });
      }
      return updated;
    });
  } else {
    [row] = await applyUpdate(db);
  }

  const changesCalendarEvent = input.scheduledAt !== undefined
    || input.status !== undefined
    || input.durationMin !== undefined
    || input.meetingProvider !== undefined
    || Object.prototype.hasOwnProperty.call(input, 'meetingLink')
    || Object.prototype.hasOwnProperty.call(input, 'locationAddress');
  if (row && changesCalendarEvent) {
    await enqueueGoogleCalendarSync({
      accountId: row.account_id,
      appointmentId: row.id,
      action: row.status === 'cancelled' ? 'delete' : 'upsert',
      specialistId: row.specialist_id,
      googleEventId: row.google_event_id ?? null,
      webUserId: row.google_event_web_user_id ?? null,
    });
  }

  return row ?? null;
}

export async function autoCancelUnpaidAppointment(input: {
  accountId: number;
  id: number;
}): Promise<AppointmentRecord | null> {
  const [row] = await db('appointments')
    .where({ account_id: input.accountId, id: input.id, is_paid: false })
    .whereIn('status', ['new', 'confirmed'])
    .update({
      status: 'cancelled',
      updated_at: db.fn.now(),
    })
    .returning<AppointmentRecord[]>('*');

  if (row) {
    await enqueueGoogleCalendarSync({
      accountId: row.account_id,
      appointmentId: row.id,
      action: 'delete',
      specialistId: row.specialist_id,
      googleEventId: row.google_event_id ?? null,
      webUserId: row.google_event_web_user_id ?? null,
    });
  }

  return row ?? null;
}

export async function createAppointmentAuditEvent(input: {
  accountId: number;
  appointmentId: number;
  action: AppointmentAuditAction;
  actorWebUserId: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db('appointment_events').insert({
    account_id: input.accountId,
    appointment_id: input.appointmentId,
    action: input.action,
    actor_web_user_id: input.actorWebUserId,
    metadata_json: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

export async function listAppointmentEventsByAppointmentIds(
  accountId: number,
  appointmentIds: number[],
  filters?: AppointmentEventsFilters,
): Promise<AppointmentAuditEventRecord[]> {
  if (appointmentIds.length === 0) {
    return [];
  }

  const query = db('appointment_events as ae')
    .leftJoin('web_users as wu', function joinActors() {
      this.on('wu.id', '=', 'ae.actor_web_user_id').andOn('wu.account_id', '=', 'ae.account_id');
    })
    .where({ 'ae.account_id': accountId })
    .whereIn('ae.appointment_id', appointmentIds)
    .orderBy('ae.created_at', 'desc');

  if (filters?.actions?.length) {
    query.whereIn('ae.action', filters.actions);
  }

  if (filters?.actorWebUserId) {
    query.andWhere('ae.actor_web_user_id', filters.actorWebUserId);
  }

  if (filters?.from) {
    query.andWhere('ae.created_at', '>=', filters.from);
  }

  if (filters?.to) {
    query.andWhere('ae.created_at', '<=', filters.to);
  }

  query.limit(Math.min(Math.max(filters?.limit ?? 500, 1), 500));

  return query.select<AppointmentAuditEventRecord[]>(
    'ae.id',
    'ae.account_id',
    'ae.appointment_id',
    'ae.action',
    'ae.actor_web_user_id',
    'ae.metadata_json',
    'ae.created_at',
    'wu.role as actor_role',
    'wu.first_name as actor_first_name',
    'wu.last_name as actor_last_name',
    'wu.email as actor_email',
  );
}

export async function ensureFallbackClientForAccount(accountId: number): Promise<number> {
  const existing = await db('clients')
    .where({ account_id: accountId })
    .orderBy('id', 'asc')
    .first<{ id: number }>('id');

  if (existing) {
    return existing.id;
  }

  const [created] = await db('clients')
    .insert({
      account_id: accountId,
      first_name: 'Web',
      email: `web-client-${accountId}@local.meetli`,
    })
    .returning<{ id: number }[]>('id');

  return created.id;
}

export async function ensureFallbackServiceForAccount(accountId: number): Promise<number> {
  const existing = await db('services')
    .where({ account_id: accountId })
    .orderBy('id', 'asc')
    .first<{ id: number }>('id');

  if (existing) {
    return existing.id;
  }

  const [created] = await db('services')
    .insert({
      account_id: accountId,
      code: `web-service-${accountId}`,
      name_ru: 'Встреча',
      name_en: 'Meeting',
      price: 0,
      currency: 'RUB',
      duration_min: 60,
      sessions_count: 1,
      is_first_free: false,
      is_active: true,
    })
    .returning<{ id: number }[]>('id');

  return created.id;
}


export async function countAppointmentsBySpecialistId(accountId: number, specialistId: number): Promise<number> {
  const row = await db('appointments')
    .where({ account_id: accountId, specialist_id: specialistId })
    .count<{ count: string }[]>({ count: '*' })
    .first();

  return Number(row?.count ?? 0);
}

export async function purgeAppointmentEventsCreatedBefore(cutoff: Date): Promise<number> {
  return db('appointment_events')
    .where('created_at', '<', cutoff)
    .delete();
}

export async function countAppointmentsByClientId(accountId: number, clientId: number): Promise<number> {
  const row = await db('appointments')
    .where({ account_id: accountId, user_id: clientId })
    .count<{ count: string }[]>({ count: '*' })
    .first();

  return Number(row?.count ?? 0);
}


export async function listUnpaidAppointmentsCreatedBetweenAllAccounts(
  from: Date,
  to: Date,
): Promise<AppointmentRecord[]> {
  return db('appointments')
    .leftJoin('clients', function joinClients() {
      this.on('clients.id', '=', 'appointments.user_id').andOn('clients.account_id', '=', 'appointments.account_id');
    })
    .where('appointments.is_paid', false)
    .whereIn('appointments.status', ['new', 'confirmed'])
    .where('appointments.created_at', '>=', from)
    .where('appointments.created_at', '<=', to)
    .orderBy('appointments.created_at', 'asc')
    .select<AppointmentRecord[]>(
      'appointments.*',
      'clients.first_name as client_first_name',
      'clients.last_name as client_last_name',
      'clients.username as client_username',
      'clients.telegram_id as client_telegram_id',
      'clients.phone as client_phone',
      'clients.email as client_email',
    );
}

export async function listUnpaidActiveAppointmentsCreatedBeforeAllAccounts(before: Date): Promise<AppointmentRecord[]> {
  return db('appointments')
    .leftJoin('clients', function joinClients() {
      this.on('clients.id', '=', 'appointments.user_id').andOn('clients.account_id', '=', 'appointments.account_id');
    })
    .where('appointments.is_paid', false)
    .whereIn('appointments.status', ['new', 'confirmed'])
    .where('appointments.created_at', '<=', before)
    .orderBy('appointments.created_at', 'asc')
    .select<AppointmentRecord[]>(
      'appointments.*',
      'clients.first_name as client_first_name',
      'clients.last_name as client_last_name',
      'clients.username as client_username',
      'clients.telegram_id as client_telegram_id',
      'clients.phone as client_phone',
      'clients.email as client_email',
    );
}
