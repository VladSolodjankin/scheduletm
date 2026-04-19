import {
  cancelAppointmentById,
  createAppointments,
  findUserAppointmentById,
  findUserAppointments,
  updateAppointmentDateTime,
} from '../repositories/appointment.repository';
import { getDefaultTimezone } from '../repositories/app-settings.repository';
import { findServiceById } from '../repositories/service.repository';
import { findSpecialistById } from '../repositories/specialist.repository';
import { createAppointmentGroup } from '../repositories/appointment-group.repository';
import { toDateTimeFromUtc, toUtcIsoFromTimezone } from '../utils/timezone';

type CreateBookingAppointmentInput = {
  accountId: number;
  userId: number;
  serviceId: number;
  specialistId: number;
  selectedDate: string;
  selectedTime: string;
};

type CreateBookingAppointmentsFromSlotsInput = {
  accountId: number;
  userId: number;
  serviceId: number;
  specialistId: number;
  slots: Array<{ date: string; time: string }>;
};

function isSlotConflictError(error: unknown) {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === '23P01'
  );
}

export async function createBookingAppointment(input: CreateBookingAppointmentInput) {
  const service = await findServiceById(input.accountId, input.serviceId);

  if (!service || !service.is_active) {
    return {
      ok: false as const,
      reason: 'service_not_found',
    };
  }

  const specialist = await findSpecialistById(input.accountId, input.specialistId);
  if (!specialist || !specialist.is_active) {
    return {
      ok: false as const,
      reason: 'specialist_not_found',
    };
  }

  const timezone = await getDefaultTimezone(input.accountId);
  const sessionCount = Math.max(1, Number(service.sessions_count ?? 1));
  const appointmentTimes = buildSessionDates(input.selectedDate, sessionCount)
    .map((date) => toUtcIsoFromTimezone(date, input.selectedTime, timezone));
  const totalPrice = calculateServicePrice({
    sessionCount,
    durationMin: service.duration_min,
    specialistBaseSessionPrice: specialist.base_session_price,
    specialistBaseHourPrice: specialist.base_hour_price,
  });

  try {
    const groupId = sessionCount > 1
      ? (await createAppointmentGroup({
        accountId: input.accountId,
        userId: input.userId,
        serviceId: input.serviceId,
        specialistId: input.specialistId,
        totalSessions: sessionCount,
        totalPrice,
        currency: service.currency,
      })).id
      : null;

    const appointments = await createAppointments(
      appointmentTimes.map((appointmentAt, index) => ({
        accountId: input.accountId,
        userId: input.userId,
        serviceId: input.serviceId,
        specialistId: input.specialistId,
        appointmentAt,
        durationMin: service.duration_min,
        price: index === 0 ? totalPrice : 0,
        currency: service.currency,
        groupId,
        isPaid: false,
      })),
    );

    return {
      ok: true as const,
      appointments,
      appointment: appointments[0],
      service,
      specialist,
    };
  } catch (error) {
    if (isSlotConflictError(error)) {
      return {
        ok: false as const,
        reason: 'slot_already_booked',
      };
    }

    throw error;
  }
}

export async function createBookingAppointmentsFromSlots(
  input: CreateBookingAppointmentsFromSlotsInput,
) {
  if (!input.slots.length) {
    return {
      ok: false as const,
      reason: 'slots_required',
    };
  }

  const service = await findServiceById(input.accountId, input.serviceId);
  if (!service || !service.is_active) {
    return {
      ok: false as const,
      reason: 'service_not_found',
    };
  }

  const specialist = await findSpecialistById(input.accountId, input.specialistId);
  if (!specialist || !specialist.is_active) {
    return {
      ok: false as const,
      reason: 'specialist_not_found',
    };
  }

  const timezone = await getDefaultTimezone(input.accountId);
  const uniqueSlots = new Set(input.slots.map((slot) => `${slot.date}T${slot.time}`));
  if (uniqueSlots.size !== input.slots.length) {
    return {
      ok: false as const,
      reason: 'duplicate_slots',
    };
  }

  const appointmentTimes = input.slots.map((slot) =>
    toUtcIsoFromTimezone(slot.date, slot.time, timezone));
  const totalPrice = calculateServicePrice({
    sessionCount: input.slots.length,
    durationMin: service.duration_min,
    specialistBaseSessionPrice: specialist.base_session_price,
    specialistBaseHourPrice: specialist.base_hour_price,
  });

  try {
    const groupId = input.slots.length > 1
      ? (await createAppointmentGroup({
        accountId: input.accountId,
        userId: input.userId,
        serviceId: input.serviceId,
        specialistId: input.specialistId,
        totalSessions: input.slots.length,
        totalPrice,
        currency: service.currency,
      })).id
      : null;

    const appointments = await createAppointments(
      appointmentTimes.map((appointmentAt, index) => ({
        accountId: input.accountId,
        userId: input.userId,
        serviceId: input.serviceId,
        specialistId: input.specialistId,
        appointmentAt,
        durationMin: service.duration_min,
        price: index === 0 ? totalPrice : 0,
        currency: service.currency,
        groupId,
        isPaid: false,
      })),
    );

    return {
      ok: true as const,
      appointments,
      appointment: appointments[0],
      service,
      specialist,
    };
  } catch (error) {
    if (isSlotConflictError(error)) {
      return {
        ok: false as const,
        reason: 'slot_already_booked',
      };
    }

    throw error;
  }
}

function buildSessionDates(startDate: string, sessionCount: number) {
  const [year, month, day] = startDate.split('-').map(Number);
  const dates: string[] = [];

  for (let index = 0; index < sessionCount; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + index * 7);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function calculateServicePrice(input: {
  sessionCount: number;
  durationMin: number;
  specialistBaseSessionPrice?: number | null;
  specialistBaseHourPrice?: number | null;
}) {
  if (input.specialistBaseSessionPrice && input.specialistBaseSessionPrice > 0) {
    return input.specialistBaseSessionPrice * input.sessionCount;
  }

  if (input.specialistBaseHourPrice && input.specialistBaseHourPrice > 0) {
    return Math.round(input.specialistBaseHourPrice * (input.durationMin / 60) * input.sessionCount);
  }

  return 0;
}

export async function getUserAppointments(accountId: number, userId: number) {
  return findUserAppointments(accountId, userId);
}

export async function getUserAppointment(accountId: number, userId: number, appointmentId: number) {
  return findUserAppointmentById(accountId, userId, appointmentId);
}

export function canEditAppointment(appointmentAt: string | Date, now = new Date()) {
  const appointmentTime = appointmentAt instanceof Date
    ? appointmentAt.getTime()
    : new Date(appointmentAt).getTime();

  const diffMs = appointmentTime - now.getTime();
  return diffMs > 24 * 60 * 60 * 1000;
}

type RescheduleAppointmentInput = {
  accountId: number;
  userId: number;
  appointmentId: number;
  selectedDate: string;
  selectedTime: string;
};

export async function rescheduleUserAppointment(input: RescheduleAppointmentInput) {
  const appointment = await findUserAppointmentById(
    input.accountId,
    input.userId,
    input.appointmentId,
  );
  if (!appointment) {
    return {
      ok: false as const,
      reason: 'appointment_not_found',
    };
  }

  if (!canEditAppointment(appointment.appointmentAt)) {
    return {
      ok: false as const,
      reason: 'too_late_to_edit',
    };
  }

  const timezone = await getDefaultTimezone(input.accountId);
  const appointmentAt = toUtcIsoFromTimezone(input.selectedDate, input.selectedTime, timezone);

  try {
    const updated = await updateAppointmentDateTime(
      input.accountId,
      input.userId,
      input.appointmentId,
      appointmentAt,
    );

    return {
      ok: true as const,
      appointment: updated,
      previous: toDateTimeFromUtc(appointment.appointmentAt, timezone),
      next: {
        date: input.selectedDate,
        time: input.selectedTime,
      },
      reminderContext: {
        serviceNameRu: appointment.serviceNameRu,
        serviceNameEn: appointment.serviceNameEn,
        specialistName: appointment.specialistName,
        appointmentAtIso: String(updated.appointment_at),
      },
    };
  } catch (error) {
    if (isSlotConflictError(error)) {
      return {
        ok: false as const,
        reason: 'slot_already_booked',
      };
    }

    throw error;
  }
}

export async function cancelUserAppointment(
  accountId: number,
  userId: number,
  appointmentId: number,
) {
  const appointment = await cancelAppointmentById(accountId, userId, appointmentId);

  if (!appointment) {
    return {
      ok: false as const,
      reason: 'appointment_not_found',
    };
  }

  return {
    ok: true as const,
  };
}
