import { db } from '../db/knex';
import { getUtcRangeForTimezoneDate, toDateTimeFromUtc } from '../utils/timezone';

type AppointmentRow = {
  appointment_at: string | Date;
};

type UserAppointmentRow = {
  id: number;
  appointment_at: string | Date;
  duration_min: number;
  status: string;
  service_id: number;
  specialist_id: number;
  service_name_ru: string;
  service_name_en: string;
  specialist_name: string;
};

type BusyAppointmentRow = {
  appointment_at: string | Date;
  duration_min: number;
};

type CreateAppointmentInput = {
  accountId: number;
  userId: number;
  serviceId: number;
  specialistId: number;
  appointmentAt: string;
  durationMin: number;
  price: number;
  currency: string;
  comment?: string | null;
};

export async function findBusyAppointmentTimesByDate(
  accountId: number,
  date: string,
  specialistId: number,
  timezone: string,
) {
  const { startIso: start, endIso: end } = getUtcRangeForTimezoneDate(date, timezone);

  const rows = (await db('appointments')
    .where({ account_id: accountId, specialist_id: specialistId })
    .whereBetween('appointment_at', [start, end])
    .whereNot('status', 'cancelled')
    .select('appointment_at')) as AppointmentRow[];

  return rows.map((row) => {
    const dateTime = toDateTimeFromUtc(row.appointment_at, timezone);
    return dateTime.time;
  });
}

export async function findBusyAppointmentsByDate(
  accountId: number,
  date: string,
  specialistId: number,
  timezone: string,
) {
  const { startIso: start, endIso: end } = getUtcRangeForTimezoneDate(date, timezone);

  const rows = (await db('appointments')
    .where({ account_id: accountId, specialist_id: specialistId })
    .whereNot('status', 'cancelled')
    .where('appointment_at', '<', end)
    .andWhereRaw(
      "appointment_at + (duration_min * interval '1 minute') > ?",
      [start],
    )
    .select('appointment_at', 'duration_min')) as BusyAppointmentRow[];

  return rows.map((row) => {
    const dateTime = toDateTimeFromUtc(row.appointment_at, timezone);

    return {
      date: dateTime.date,
      time: dateTime.time,
      durationMin: row.duration_min,
    };
  });
}

export async function createAppointment(input: CreateAppointmentInput) {
  const [appointment] = await db('appointments')
    .insert({
      account_id: input.accountId,
      user_id: input.userId,
      service_id: input.serviceId,
      specialist_id: input.specialistId,
      appointment_at: input.appointmentAt,
      duration_min: input.durationMin,
      status: 'new',
      comment: input.comment ?? null,
      price: input.price,
      currency: input.currency,
    })
    .returning('*');

  return appointment;
}

export async function findUserAppointments(accountId: number, userId: number) {
  const rows = (await db('appointments as a')
    .join('services as s', function joinServices() {
      this.on('s.id', '=', 'a.service_id').andOn('s.account_id', '=', 'a.account_id');
    })
    .join('specialists as sp', function joinSpecialists() {
      this.on('sp.id', '=', 'a.specialist_id').andOn('sp.account_id', '=', 'a.account_id');
    })
    .where('a.account_id', accountId)
    .where('a.user_id', userId)
    .whereNot('a.status', 'cancelled')
    .orderBy('a.appointment_at', 'asc')
    .select(
      'a.id',
      'a.appointment_at',
      'a.duration_min',
      'a.status',
      'a.service_id',
      'a.specialist_id',
      's.name_ru as service_name_ru',
      's.name_en as service_name_en',
      'sp.name as specialist_name',
    )) as UserAppointmentRow[];

  return rows.map((row) => ({
    id: row.id,
    appointmentAt: row.appointment_at,
    durationMin: row.duration_min,
    status: row.status,
    serviceId: row.service_id,
    specialistId: row.specialist_id,
    serviceNameRu: row.service_name_ru,
    serviceNameEn: row.service_name_en,
    specialistName: row.specialist_name,
  }));
}

export async function findUserAppointmentById(
  accountId: number,
  userId: number,
  appointmentId: number,
) {
  const row = (await db('appointments as a')
    .join('services as s', function joinServices() {
      this.on('s.id', '=', 'a.service_id').andOn('s.account_id', '=', 'a.account_id');
    })
    .join('specialists as sp', function joinSpecialists() {
      this.on('sp.id', '=', 'a.specialist_id').andOn('sp.account_id', '=', 'a.account_id');
    })
    .where('a.account_id', accountId)
    .where('a.user_id', userId)
    .where('a.id', appointmentId)
    .whereNot('a.status', 'cancelled')
    .select(
      'a.id',
      'a.appointment_at',
      'a.duration_min',
      'a.status',
      'a.service_id',
      'a.specialist_id',
      's.name_ru as service_name_ru',
      's.name_en as service_name_en',
      'sp.name as specialist_name',
    )
    .first()) as UserAppointmentRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    appointmentAt: row.appointment_at,
    durationMin: row.duration_min,
    status: row.status,
    serviceId: row.service_id,
    specialistId: row.specialist_id,
    serviceNameRu: row.service_name_ru,
    serviceNameEn: row.service_name_en,
    specialistName: row.specialist_name,
  };
}

export async function updateAppointmentDateTime(
  accountId: number,
  userId: number,
  appointmentId: number,
  appointmentAt: string,
) {
  const [appointment] = await db('appointments')
    .where({
      account_id: accountId,
      id: appointmentId,
      user_id: userId,
    })
    .update(
      {
        appointment_at: appointmentAt,
        updated_at: db.fn.now(),
      },
      ['*'],
    );

  return appointment;
}


export async function cancelAppointmentById(
  accountId: number,
  userId: number,
  appointmentId: number,
) {
  const [appointment] = await db('appointments')
    .where({
      account_id: accountId,
      id: appointmentId,
      user_id: userId,
    })
    .whereNot('status', 'cancelled')
    .update(
      {
        status: 'cancelled',
        updated_at: db.fn.now(),
      },
      ['*'],
    );

  return appointment ?? null;
}
