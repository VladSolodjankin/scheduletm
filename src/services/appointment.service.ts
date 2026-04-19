import {
  cancelAppointmentById,
  createAppointment,
  findUserAppointmentById,
  findUserAppointments,
  updateAppointmentDateTime,
} from '../repositories/appointment.repository';
import { getDefaultTimezone } from '../repositories/app-settings.repository';
import { findServiceById } from '../repositories/service.repository';
import { toDateTimeFromUtc, toUtcIsoFromTimezone } from '../utils/timezone';

type CreateBookingAppointmentInput = {
  accountId: number;
  userId: number;
  serviceId: number;
  specialistId: number;
  selectedDate: string;
  selectedTime: string;
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

  const timezone = await getDefaultTimezone(input.accountId);
  const appointmentAt = toUtcIsoFromTimezone(input.selectedDate, input.selectedTime, timezone);

  try {
    const appointment = await createAppointment({
      accountId: input.accountId,
      userId: input.userId,
      serviceId: input.serviceId,
      specialistId: input.specialistId,
      appointmentAt,
      durationMin: service.duration_min,
      price: service.price,
      currency: service.currency,
    });

    return {
      ok: true as const,
      appointment,
      service,
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
