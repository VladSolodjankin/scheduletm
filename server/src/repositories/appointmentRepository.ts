import { db } from '../db/knex.js';

export type AppointmentStatus = 'new' | 'confirmed' | 'cancelled';

export type AppointmentRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  appointment_at: Date;
  status: AppointmentStatus;
  comment: string | null;
  duration_min: number;
  user_id: number;
  service_id: number;
  created_at: Date;
  updated_at: Date;
};

type AppointmentListFilters = {
  accountId: number;
  from?: Date;
  to?: Date;
  specialistId?: number;
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
};

export async function listAppointments(filters: AppointmentListFilters): Promise<AppointmentRecord[]> {
  const query = db('appointments')
    .where({ account_id: filters.accountId })
    .orderBy('appointment_at', 'asc');

  if (filters.specialistId) {
    query.andWhere('specialist_id', filters.specialistId);
  }

  if (filters.from) {
    query.andWhere('appointment_at', '>=', filters.from);
  }

  if (filters.to) {
    query.andWhere('appointment_at', '<=', filters.to);
  }

  return query.select<AppointmentRecord[]>('*');
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

  const [row] = await db('appointments')
    .where({ account_id: input.accountId, id: input.id })
    .update(payload)
    .returning<AppointmentRecord[]>('*');

  return row ?? null;
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
