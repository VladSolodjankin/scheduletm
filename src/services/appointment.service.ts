import {
  createAppointment,
  findUserAppointmentById,
  findUserAppointments,
  updateAppointmentDateTime,
} from '../repositories/appointment.repository';
import { findServiceById } from '../repositories/service.repository';
import { toMoscowDateTimeFromUtc, toUtcIsoFromMoscow } from '../utils/timezone';

type CreateBookingAppointmentInput = {
  userId: number;
  serviceId: number;
  specialistId: number;
  selectedDate: string;
  selectedTime: string;
};

export async function createBookingAppointment(input: CreateBookingAppointmentInput) {
  const service = await findServiceById(input.serviceId);

  if (!service || !service.is_active) {
    return {
      ok: false as const,
      reason: 'service_not_found',
    };
  }

  const appointmentAt = toUtcIsoFromMoscow(input.selectedDate, input.selectedTime);

  const appointment = await createAppointment({
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
}

export async function getUserAppointments(userId: number) {
  return findUserAppointments(userId);
}

export async function getUserAppointment(userId: number, appointmentId: number) {
  return findUserAppointmentById(userId, appointmentId);
}

export function canEditAppointment(appointmentAt: string | Date, now = new Date()) {
  const appointmentTime = appointmentAt instanceof Date
    ? appointmentAt.getTime()
    : new Date(appointmentAt).getTime();

  const diffMs = appointmentTime - now.getTime();
  return diffMs > 24 * 60 * 60 * 1000;
}

type RescheduleAppointmentInput = {
  userId: number;
  appointmentId: number;
  selectedDate: string;
  selectedTime: string;
};

export async function rescheduleUserAppointment(input: RescheduleAppointmentInput) {
  const appointment = await findUserAppointmentById(input.userId, input.appointmentId);
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

  const appointmentAt = toUtcIsoFromMoscow(input.selectedDate, input.selectedTime);
  const updated = await updateAppointmentDateTime(input.userId, input.appointmentId, appointmentAt);

  return {
    ok: true as const,
    appointment: updated,
    previous: toMoscowDateTimeFromUtc(appointment.appointmentAt),
    next: {
      date: input.selectedDate,
      time: input.selectedTime,
    },
  };
}
