import { db } from '../db/knex.js';

export type PublicBookingSpecialist = {
  id: number;
  account_id: number;
  name: string;
  timezone: string;
  work_start_hour: number;
  work_end_hour: number;
  work_days: string;
  slot_step_min: number;
  is_active: boolean;
};

export type PublicBookingService = {
  id: number;
  account_id: number;
  name_ru: string;
  name_en: string;
  duration_min: number;
  price: number;
  currency: string;
  is_active: boolean;
};

export type PublicAppointmentStatusRecord = {
  id: number;
  status: 'new' | 'confirmed' | 'cancelled';
  appointment_at: Date;
  duration_min: number;
  comment: string | null;
  specialist_name: string;
  service_name_ru: string;
  service_name_en: string;
  business_address: string | null;
};

export async function listPublicBookingSpecialists(accountId: number): Promise<PublicBookingSpecialist[]> {
  return db('specialists as s')
    .join('specialist_services as ssv', function joinAssignments() {
      this.on('ssv.specialist_id', '=', 's.id').andOn('ssv.account_id', '=', 's.account_id');
    })
    .join('services as sv', function joinAssignedService() {
      this.on('sv.id', '=', 'ssv.service_id').andOn('sv.account_id', '=', 'ssv.account_id');
    })
    .leftJoin('web_users as wu', function joinUser() {
      this.on('wu.id', '=', 's.user_id').andOn('wu.account_id', '=', 's.account_id');
    })
    .leftJoin('specialist_settings as ss', function joinSpecialistSettings() {
      this.on('ss.specialist_id', '=', 's.id').andOn('ss.account_id', '=', 's.account_id');
    })
    .leftJoin('app_settings as aps', 'aps.account_id', 's.account_id')
    .where({ 's.account_id': accountId, 's.is_active': true, 'ssv.is_active': true, 'sv.is_active': true })
    .distinct()
    .orderBy('s.name', 'asc')
    .select(
      's.id', 's.account_id', 's.name', 's.is_active',
      db.raw("COALESCE(wu.timezone, aps.timezone, 'UTC') as timezone"),
      db.raw('COALESCE(ss.work_start_hour, aps.work_start_hour, 9) as work_start_hour'),
      db.raw('COALESCE(ss.work_end_hour, aps.work_end_hour, 20) as work_end_hour'),
      db.raw("COALESCE(aps.work_days, '1,2,3,4,5,6') as work_days"),
      db.raw('COALESCE(ss.slot_step_min, s.slot_step_min, 30) as slot_step_min'),
    );
}

export async function listPublicBookingServices(accountId: number): Promise<PublicBookingService[]> {
  return db('services as sv')
    .join('specialist_services as ss', function joinAssignments() {
      this.on('ss.service_id', '=', 'sv.id').andOn('ss.account_id', '=', 'sv.account_id');
    })
    .join('specialists as sp', function joinSpecialist() {
      this.on('sp.id', '=', 'ss.specialist_id').andOn('sp.account_id', '=', 'ss.account_id');
    })
    .where({ 'sv.account_id': accountId, 'sv.is_active': true, 'ss.is_active': true, 'sp.is_active': true })
    .distinct()
    .orderBy('sv.name_en', 'asc')
    .select('sv.id', 'sv.account_id', 'sv.name_ru', 'sv.name_en', 'sv.duration_min', 'sv.price', 'sv.currency', 'sv.is_active');
}

export async function findPublicBookingSpecialist(
  accountId: number,
  specialistId: number,
): Promise<PublicBookingSpecialist | null> {
  return (await db('specialists as s')
    .leftJoin('web_users as wu', function joinUser() {
      this.on('wu.id', '=', 's.user_id').andOn('wu.account_id', '=', 's.account_id');
    })
    .leftJoin('specialist_settings as ss', function joinSpecialistSettings() {
      this.on('ss.specialist_id', '=', 's.id').andOn('ss.account_id', '=', 's.account_id');
    })
    .leftJoin('app_settings as aps', 'aps.account_id', 's.account_id')
    .where({ 's.account_id': accountId, 's.id': specialistId, 's.is_active': true })
    .select(
      's.id', 's.account_id', 's.name', 's.is_active',
      db.raw("COALESCE(wu.timezone, aps.timezone, 'UTC') as timezone"),
      db.raw('COALESCE(ss.work_start_hour, aps.work_start_hour, 9) as work_start_hour'),
      db.raw('COALESCE(ss.work_end_hour, aps.work_end_hour, 20) as work_end_hour'),
      db.raw("COALESCE(aps.work_days, '1,2,3,4,5,6') as work_days"),
      db.raw('COALESCE(ss.slot_step_min, s.slot_step_min, 30) as slot_step_min'),
    )
    .first<PublicBookingSpecialist>()) ?? null;
}

export async function findPublicBookingService(
  accountId: number,
  serviceId: number,
  specialistId: number,
): Promise<PublicBookingService | null> {
  return (await db('services as sv')
    .join('specialist_services as ss', function joinAssignment() {
      this.on('ss.service_id', '=', 'sv.id').andOn('ss.account_id', '=', 'sv.account_id');
    })
    .join('specialists as sp', function joinSpecialist() {
      this.on('sp.id', '=', 'ss.specialist_id').andOn('sp.account_id', '=', 'ss.account_id');
    })
    .where({
      'sv.account_id': accountId, 'sv.id': serviceId, 'sv.is_active': true,
      'ss.specialist_id': specialistId, 'ss.is_active': true, 'sp.is_active': true,
    })
    .select(
      'sv.id', 'sv.account_id', 'sv.name_ru', 'sv.name_en',
      db.raw('COALESCE(ss.duration_override_minutes, sv.duration_min) as duration_min'),
      db.raw('COALESCE(ss.price_override, sv.price) as price'),
      'sv.currency', 'sv.is_active',
    )
    .first<PublicBookingService>()) ?? null;
}

export async function createPublicGuestAppointment(input: {
  accountId: number;
  specialistId: number;
  serviceId: number;
  startAt: Date;
  durationMin: number;
  price: number;
  currency: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  telegramUsername?: string;
  timezone: string;
  meetingProvider: 'manual' | 'zoom' | 'offline';
}): Promise<{ id: number; status: 'new'; appointment_at: Date; duration_min: number }> {
  return db.transaction(async (trx) => {
    const endAt = new Date(input.startAt.getTime() + input.durationMin * 60_000);
    const conflict = await trx('appointments')
      .where({
        account_id: input.accountId,
        specialist_id: input.specialistId,
      })
      .whereNot({ status: 'cancelled' })
      .andWhere('appointment_at', '<', endAt)
      .andWhere('appointment_end_at', '>', input.startAt)
      .first('id');
    if (conflict) throw new PublicBookingRepositoryError('SLOT_CONFLICT');

    const email = input.email?.trim().toLowerCase() || null;
    const phone = input.phone?.trim() || null;
    const username = input.telegramUsername?.trim() || null;
    let client = await trx('clients')
      .where({ account_id: input.accountId })
      .andWhere((query) => {
        if (email) query.orWhereRaw('LOWER(email) = ?', [email]);
        if (phone) query.orWhere('phone', phone);
      })
      .orderBy('id', 'asc')
      .first<{ id: number }>('id');
    if (!client) {
      [client] = await trx('clients').insert({
        account_id: input.accountId,
        first_name: input.firstName,
        last_name: input.lastName,
        email,
        phone,
        username,
        timezone: input.timezone,
      }).returning<{ id: number }[]>('id');
    }

    try {
      const [appointment] = await trx('appointments').insert({
        account_id: input.accountId,
        specialist_id: input.specialistId,
        appointment_at: input.startAt,
        status: 'new',
        comment: `meetingProvider: ${input.meetingProvider}`,
        duration_min: input.durationMin,
        user_id: client.id,
        service_id: input.serviceId,
        is_first_time: false,
        price: input.price,
        currency: input.currency,
        is_paid: false,
      }).returning<Array<{ id: number; status: 'new'; appointment_at: Date; duration_min: number }>>(
        ['id', 'status', 'appointment_at', 'duration_min'],
      );
      return appointment;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01') {
        throw new PublicBookingRepositoryError('SLOT_CONFLICT');
      }
      throw error;
    }
  });
}

export async function findPublicAppointmentStatus(
  accountId: number,
  appointmentId: number,
): Promise<PublicAppointmentStatusRecord | null> {
  return (await db('appointments as a')
    .join('specialists as s', function joinSpecialist() {
      this.on('s.id', '=', 'a.specialist_id').andOn('s.account_id', '=', 'a.account_id');
    })
    .join('services as sv', function joinService() {
      this.on('sv.id', '=', 'a.service_id').andOn('sv.account_id', '=', 'a.account_id');
    })
    .leftJoin('account_settings as aset', 'aset.account_id', 'a.account_id')
    .where({ 'a.account_id': accountId, 'a.id': appointmentId })
    .select(
      'a.id', 'a.status', 'a.appointment_at', 'a.duration_min', 'a.comment',
      's.name as specialist_name',
      'sv.name_ru as service_name_ru',
      'sv.name_en as service_name_en',
      'aset.business_address',
    )
    .first<PublicAppointmentStatusRecord>()) ?? null;
}

export class PublicBookingRepositoryError extends Error {
  constructor(public readonly code: 'SLOT_CONFLICT') {
    super(code);
  }
}
