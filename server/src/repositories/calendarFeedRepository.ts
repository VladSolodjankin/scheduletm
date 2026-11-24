import { db } from '../db/knex.js';

export type CalendarFeedAppointment = {
  id: number;
  appointment_at: Date;
  duration_min: number;
  meeting_provider: string;
  location_address: string | null;
  created_at: Date;
  updated_at: Date | null;
  service_name_en: string | null;
  service_name_ru: string | null;
  business_address: string | null;
};

/**
 * Non-cancelled appointments of one specialist inside the window. Deliberately selects no client columns
 * and no meeting link: the feed is a bearer-URL document that must stay privacy-minimised.
 */
export async function listCalendarFeedAppointments(input: {
  accountId: number;
  specialistId: number;
  from: Date;
  to: Date;
}): Promise<CalendarFeedAppointment[]> {
  return db('appointments as a')
    .leftJoin('services as sv', function joinService() {
      this.on('sv.id', '=', 'a.service_id').andOn('sv.account_id', '=', 'a.account_id');
    })
    .leftJoin('account_settings as aset', 'aset.account_id', 'a.account_id')
    .where({ 'a.account_id': input.accountId, 'a.specialist_id': input.specialistId })
    .whereNot('a.status', 'cancelled')
    .where('a.appointment_at', '>=', input.from)
    .where('a.appointment_at', '<', input.to)
    .orderBy('a.appointment_at', 'asc')
    .select<CalendarFeedAppointment[]>(
      'a.id', 'a.appointment_at', 'a.duration_min', 'a.meeting_provider', 'a.location_address',
      'a.created_at', 'a.updated_at',
      'sv.name_en as service_name_en', 'sv.name_ru as service_name_ru',
      'aset.business_address',
    );
}
