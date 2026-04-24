import { db } from '../db/knex.js';

export type AppointmentStatus = 'new' | 'confirmed' | 'cancelled';
export type AppointmentAuditAction = 'cancel' | 'reschedule' | 'mark-paid' | 'notify';

export type AppointmentRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  appointment_at: Date;
  status: AppointmentStatus;
  comment: string | null;
  duration_min: number;
  is_paid: boolean;
  user_id: number;
  service_id: number;
  created_at: Date;
  updated_at: Date;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_username?: string | null;
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
  userId: number;
  serviceId: number;
  durationMin: number;
};

type UpdateAppointmentInput = {
  accountId: number;
  id: number;
  scheduledAt?: Date;
  status?: AppointmentStatus;
  notes?: string | null;
  durationMin?: number;
  isPaid?: boolean;
  userId?: number;
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

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord> {
  const [row] = await db('appointments')
    .insert({
      account_id: input.accountId,
      specialist_id: input.specialistId,
      appointment_at: input.scheduledAt,
      status: input.status,
      comment: input.notes,
      user_id: input.userId,
      service_id: input.serviceId,
      duration_min: input.durationMin,
      is_first_time: false,
      price: 0,
      currency: 'RUB',
      is_paid: false,
    })
    .returning<AppointmentRecord[]>('*');

  return row;
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

  if (input.durationMin !== undefined) {
    payload.duration_min = input.durationMin;
  }

  if (input.isPaid !== undefined) {
    payload.is_paid = input.isPaid;
  }

  if (input.userId !== undefined) {
    payload.user_id = input.userId;
  }

  const [row] = await db('appointments')
    .where({ account_id: input.accountId, id: input.id })
    .update(payload)
    .returning<AppointmentRecord[]>('*');

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
): Promise<AppointmentAuditEventRecord[]> {
  if (appointmentIds.length === 0) {
    return [];
  }

  return db('appointment_events')
    .where({ account_id: accountId })
    .whereIn('appointment_id', appointmentIds)
    .orderBy('created_at', 'desc')
    .select<AppointmentAuditEventRecord[]>('*');
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
