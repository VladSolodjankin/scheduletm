import { db } from '../db/knex';
import { getUtcRangeForMoscowDate, toMoscowDateTimeFromUtc } from '../utils/timezone';

type AppointmentRow = {
  appointment_at: string | Date;
};

type CreateAppointmentInput = {
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
  date: string,
  specialistId: number,
) {
  const { startIso: start, endIso: end } = getUtcRangeForMoscowDate(date);

  const rows = (await db('appointments')
    .where('specialist_id', specialistId)
    .whereBetween('appointment_at', [start, end])
    .whereNot('status', 'cancelled')
    .select('appointment_at')) as AppointmentRow[];

  return rows.map((row) => {
    const dateTime = toMoscowDateTimeFromUtc(row.appointment_at);
    return dateTime.time;
  });
}

export async function createAppointment(input: CreateAppointmentInput) {
  const [appointment] = await db('appointments')
    .insert({
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
