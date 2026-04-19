import { findBusyAppointmentsByDate } from '../repositories/appointment.repository';
import { getAppSettings } from '../repositories/app-settings.repository';
import { findServiceById } from '../repositories/service.repository';

const SLOT_STEP_MIN = 30;
const MINUTES_IN_DAY = 24 * 60;

function buildDaySlots(durationMin: number, workStartHour: number, workEndHour: number) {
  const startMinutes = workStartHour * 60;
  const endMinutes = workEndHour * 60;
  const slots: string[] = [];

  for (
    let minute = startMinutes;
    minute + durationMin <= endMinutes;
    minute += SLOT_STEP_MIN
  ) {
    const hours = String(Math.floor(minute / 60)).padStart(2, '0');
    const mins = String(minute % 60).padStart(2, '0');
    slots.push(`${hours}:${mins}`);
  }

  return slots;
}

function parseDateToUtcMs(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function getDateOffsetInDays(targetDate: string, selectedDate: string) {
  const diffMs = parseDateToUtcMs(targetDate) - parseDateToUtcMs(selectedDate);
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export async function getAvailableSlots(params: {
  accountId: number;
  date: string;
  specialistId: number;
  serviceId: number;
}) {
  const service = await findServiceById(params.accountId, params.serviceId);
  const settings = await getAppSettings(params.accountId);
  const durationMin = service?.duration_min ?? 90;

  const allSlots = buildDaySlots(durationMin, settings.workStartHour, settings.workEndHour);
  const busyAppointments = await findBusyAppointmentsByDate(
    params.accountId,
    params.date,
    params.specialistId,
  );

  const busyIntervals = busyAppointments.map((appointment) => {
    const dayOffset = getDateOffsetInDays(appointment.date, params.date);
    const startMinute = dayOffset * MINUTES_IN_DAY + parseTimeToMinutes(appointment.time);

    return {
      startMinute,
      endMinute: startMinute + appointment.durationMin,
    };
  });

  return allSlots.filter((slot) => {
    const slotStart = parseTimeToMinutes(slot);
    const slotEnd = slotStart + durationMin;

    return !busyIntervals.some(
      (busy) => slotStart < busy.endMinute && slotEnd > busy.startMinute,
    );
  });
}
