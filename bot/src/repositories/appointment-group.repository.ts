import { db } from '../db/knex';

type CreateAppointmentGroupInput = {
  accountId: number;
  userId: number;
  serviceId: number;
  specialistId: number;
  totalSessions: number;
  totalPrice: number;
  currency: string;
};

export async function createAppointmentGroup(input: CreateAppointmentGroupInput) {
  const [group] = await db('appointment_groups')
    .insert({
      account_id: input.accountId,
      user_id: input.userId,
      service_id: input.serviceId,
      specialist_id: input.specialistId,
      total_sessions: input.totalSessions,
      total_price: input.totalPrice,
      currency: input.currency,
      payment_status: 'unpaid',
    })
    .returning('*');

  return group;
}
