import { createAppointment } from '../repositories/appointment.repository';
import { findServiceById } from '../repositories/service.repository';

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

  const appointmentAt = `${input.selectedDate}T${input.selectedTime}:00.000Z`;

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
