import { normalizePublicPageSlug, isValidPublicPageSlug } from '../config/publicPageSchemas.js';
import { findPublishedPublicPageBySlug } from '../repositories/publicPageRepository.js';
import {
  createPublicGuestAppointment,
  findPublicAppointmentStatus,
  findPublicBookingService,
  findPublicBookingSpecialist,
  listPublicBookingServices,
  listPublicBookingSpecialists,
} from '../repositories/publicBookingRepository.js';
import { listExternalBusySlots } from './calendarAvailabilityService.js';
import { publicMediaUrl } from './serviceService.js';
import { listAppointments } from '../repositories/appointmentRepository.js';
import { sendAppointmentNotificationByType } from './appointmentNotificationService.js';

export class PublicBookingServiceError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'INVALID_SELECTION' | 'SLOT_UNAVAILABLE') {
    super(code);
  }
}

const weekdayNumbers: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

function localSlotParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: weekdayNumbers[value('weekday')],
    minuteOfDay: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

function isWithinWorkingSchedule(
  startAt: Date,
  durationMin: number,
  specialist: {
    timezone: string;
    work_start_hour: number;
    work_end_hour: number;
    work_days: string;
    slot_step_min: number;
  },
) {
  if (!Number.isFinite(startAt.getTime()) || startAt.getUTCSeconds() !== 0 || startAt.getUTCMilliseconds() !== 0) {
    return false;
  }
  const start = localSlotParts(startAt, specialist.timezone);
  const end = localSlotParts(
    new Date(startAt.getTime() + durationMin * 60_000),
    specialist.timezone,
  );
  const workDays = new Set(
    specialist.work_days.split(',').map(Number).filter((day) => day >= 1 && day <= 7),
  );
  const workStart = specialist.work_start_hour * 60;
  const workEnd = specialist.work_end_hour * 60;
  return workDays.has(start.weekday)
    && end.weekday === start.weekday
    && start.minuteOfDay >= workStart
    && end.minuteOfDay <= workEnd
    && (start.minuteOfDay - workStart) % specialist.slot_step_min === 0;
}

function overlaps(
  startAt: Date,
  durationMin: number,
  busy: { scheduledAt: string; durationMin: number },
) {
  const start = startAt.getTime();
  const end = start + durationMin * 60_000;
  const busyStart = new Date(busy.scheduledAt).getTime();
  const busyEnd = busyStart + busy.durationMin * 60_000;
  return start < busyEnd && busyStart < end;
}

async function resolvePublishedAccount(slugInput: string): Promise<number> {
  if (!isValidPublicPageSlug(slugInput)) throw new PublicBookingServiceError('NOT_FOUND');
  const page = await findPublishedPublicPageBySlug(normalizePublicPageSlug(slugInput));
  if (!page) throw new PublicBookingServiceError('NOT_FOUND');
  return page.account_id;
}

export async function getPublicBookingOptions(slug: string) {
  const accountId = await resolvePublishedAccount(slug);
  const [specialists, services] = await Promise.all([
    listPublicBookingSpecialists(accountId),
    listPublicBookingServices(accountId),
  ]);
  return {
    specialists: specialists.map((item) => ({ id: item.id, name: item.name })),
    services: services.map((item) => ({
      id: item.id,
      name: item.name_en || item.name_ru,
      durationMin: item.duration_min,
      price: item.price,
      currency: item.currency,
      description: item.description,
      firstSessionFree: item.is_first_free,
      imageUrl: item.image_media_id ? publicMediaUrl(item.image_media_id) : null,
    })),
  };
}

export async function bookPublicAppointment(slug: string, input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  telegramUsername?: string;
  specialistId: number;
  serviceId: number;
  startAt: string;
  timezone?: string;
  meetingProvider?: 'manual' | 'zoom' | 'offline';
}) {
  const accountId = await resolvePublishedAccount(slug);
  const [specialist, service] = await Promise.all([
    findPublicBookingSpecialist(accountId, input.specialistId),
    findPublicBookingService(accountId, input.serviceId, input.specialistId),
  ]);
  if (!specialist || !service) throw new PublicBookingServiceError('INVALID_SELECTION');
  const startAt = new Date(input.startAt);
  if (
    startAt.getTime() <= Date.now()
    || !isWithinWorkingSchedule(startAt, service.duration_min, specialist)
  ) {
    throw new PublicBookingServiceError('SLOT_UNAVAILABLE');
  }
  const endAt = new Date(startAt.getTime() + service.duration_min * 60_000);
  const externalBusySlots = await listExternalBusySlots({
    accountId,
    specialistIds: [specialist.id],
    from: startAt,
    to: endAt,
  });
  if (externalBusySlots.some((slot) => overlaps(startAt, service.duration_min, slot))) {
    throw new PublicBookingServiceError('SLOT_UNAVAILABLE');
  }
  const appointment = await createPublicGuestAppointment({
    accountId,
    specialistId: specialist.id,
    serviceId: service.id,
    startAt,
    durationMin: service.duration_min,
    price: service.price,
    currency: service.currency,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    telegramUsername: input.telegramUsername,
    timezone: input.timezone ?? specialist.timezone ?? 'UTC',
    meetingProvider: input.meetingProvider ?? 'offline',
  });
  // Delivery failure must not turn a committed booking into a failed request.
  try {
    const appointments = await listAppointments({ accountId, specialistId: specialist.id, from: startAt, to: endAt });
    const hydrated = appointments.find((item) => item.id === appointment.id);
    if (hydrated) {
      await sendAppointmentNotificationByType({ accountId, appointment: hydrated, notificationType: 'appointment_created' });
    }
  } catch (error) {
    console.error('Public booking notification failed', error);
  }
  return {
    id: appointment.id,
    status: appointment.status,
    scheduledAt: new Date(appointment.appointment_at).toISOString(),
    duration: appointment.duration_min,
  };
}

function meetingInfo(
  provider: 'manual' | 'zoom' | 'offline',
  meetingUrl: string | null,
  location: string | null,
  businessAddress: string | null,
) {
  return {
    provider,
    ...(meetingUrl ? { meetingUrl } : {}),
    ...(provider === 'offline' && (location || businessAddress)
      ? { location: location || businessAddress || undefined } : {}),
  };
}

export async function getPublicAppointmentStatus(
  slug: string,
  appointmentId: number,
  specialistLastName: string,
) {
  const accountId = await resolvePublishedAccount(slug);
  const appointment = await findPublicAppointmentStatus(accountId, appointmentId);
  const expectedLastName = appointment?.specialist_name.trim().split(/\s+/).at(-1)?.toLocaleLowerCase();
  if (!appointment || expectedLastName !== specialistLastName.trim().toLocaleLowerCase()) {
    throw new PublicBookingServiceError('NOT_FOUND');
  }
  return {
    status: appointment.status,
    scheduledAt: new Date(appointment.appointment_at).toISOString(),
    duration: appointment.duration_min,
    service: appointment.service_name_en || appointment.service_name_ru,
    specialist: appointment.specialist_name,
    meeting: meetingInfo(appointment.meeting_provider, appointment.meeting_link, appointment.location_address, appointment.business_address),
  };
}
