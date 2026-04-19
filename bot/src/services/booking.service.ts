import { findActiveServices, findServiceById } from '../repositories/service.repository';
import {
  findActiveSpecialists,
  findSingleDefaultActiveSpecialist,
  findSpecialistById,
} from '../repositories/specialist.repository';
import {
  mergeSessionPayload,
  updateSessionState,
} from '../repositories/user-session.repository';
import { UserSessionState } from '../types/session';
import { getNextAvailableDates } from './date.service';

export async function startBooking(accountId: number, userId: number) {
  await updateSessionState(accountId, userId, UserSessionState.CHOOSING_SERVICE, {});
  return findActiveServices(accountId);
}

export async function selectService(accountId: number, userId: number, serviceId: number) {
  const service = await findServiceById(accountId, serviceId);
  if (!service || !service.is_active) {
    return { ok: false as const, reason: 'service_not_found' };
  }

  await mergeSessionPayload(accountId, userId, UserSessionState.CHOOSING_SPECIALIST, {
    serviceId: service.id,
    totalSessions: Math.max(1, Number(service.sessions_count ?? 1)),
    selectedSlots: [],
    currentSlotIndex: 0,
    datePageOffset: 0,
  });

  const defaultSpecialist = await findSingleDefaultActiveSpecialist(accountId);

  if (defaultSpecialist) {
    await mergeSessionPayload(accountId, userId, UserSessionState.CHOOSING_DATE, {
      serviceId: service.id,
      specialistId: defaultSpecialist.id,
      totalSessions: Math.max(1, Number(service.sessions_count ?? 1)),
      selectedSlots: [],
      currentSlotIndex: 0,
      datePageOffset: 0,
    });

    return {
      ok: true as const,
      skipSpecialist: true as const,
      service,
      specialist: defaultSpecialist,
      dates: await getNextAvailableDates(accountId),
    };
  }

  const specialists = await findActiveSpecialists(accountId);

  return {
    ok: true as const,
    skipSpecialist: false as const,
    service,
    specialists,
  };
}

export async function selectSpecialist(accountId: number, userId: number, specialistId: number) {
  const specialist = await findSpecialistById(accountId, specialistId);

  if (!specialist || !specialist.is_active) {
    return { ok: false as const, reason: 'specialist_not_found' };
  }

  await mergeSessionPayload(accountId, userId, UserSessionState.CHOOSING_DATE, {
    specialistId: specialist.id,
  });

  return {
    ok: true as const,
    specialist,
    dates: await getNextAvailableDates(accountId),
  };
}
