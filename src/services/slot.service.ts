import { findBusyAppointmentTimesByDate } from '../repositories/appointment.repository';
import { findServiceById } from '../repositories/service.repository';

function buildDaySlots(durationMin: number) {
  const startMinutes = 9 * 60;
  const endMinutes = 20 * 60;
  const slots: string[] = [];

  for (
    let minute = startMinutes;
    minute + durationMin <= endMinutes;
    minute += durationMin
  ) {
    const hours = String(Math.floor(minute / 60)).padStart(2, '0');
    const mins = String(minute % 60).padStart(2, '0');
    slots.push(`${hours}:${mins}`);
  }

  return slots;
}

export async function getAvailableSlots(params: {
  date: string;
  specialistId: number;
  serviceId: number;
}) {
  const service = await findServiceById(params.serviceId);
  const durationMin = service?.duration_min ?? 90;

  const allSlots = buildDaySlots(durationMin);
  const busySlots = await findBusyAppointmentTimesByDate(
    params.date,
    params.specialistId,
  );

  const busySet = new Set(busySlots);
  return allSlots.filter((slot) => !busySet.has(slot));
}
