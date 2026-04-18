import { db } from '../db/knex';

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
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const rows = (await db('appointments')
    .where('specialist_id', specialistId)
    .whereBetween('appointment_at', [start, end])
    .whereNot('status', 'cancelled')
    .select('appointment_at')) as AppointmentRow[];

  return rows.map((row) => {
    const value = row.appointment_at instanceof Date
      ? row.appointment_at.toISOString()
      : String(row.appointment_at);

    const dateValue = new Date(value);
    const hours = String(dateValue.getUTCHours()).padStart(2, '0');
    const minutes = String(dateValue.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
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
