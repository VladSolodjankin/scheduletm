import { findActiveServices, findAssignedActiveSpecialists, findServiceById } from '../repositories/service.repository';
import {
  findSingleDefaultActiveSpecialist,
  findSpecialistById,
} from '../repositories/specialist.repository';
import {
  getSessionPayload,
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

  const specialists = await findAssignedActiveSpecialists(accountId, service.id);
  const defaultSpecialist = await findSingleDefaultActiveSpecialist(accountId);
  const assignedDefault = defaultSpecialist
    ? specialists.find(({ id }) => id === defaultSpecialist.id)
    : undefined;

  if (assignedDefault) {
    const effectiveService = await findServiceById(accountId, service.id, assignedDefault.id);
    await mergeSessionPayload(accountId, userId, UserSessionState.CHOOSING_DATE, {
      serviceId: service.id,
      specialistId: assignedDefault.id,
      totalSessions: Math.max(1, Number(service.sessions_count ?? 1)),
      selectedSlots: [],
      currentSlotIndex: 0,
      datePageOffset: 0,
    });

    return {
      ok: true as const,
      skipSpecialist: true as const,
      service: effectiveService,
      specialist: assignedDefault,
      dates: await getNextAvailableDates(accountId),
    };
  }

  return {
    ok: true as const,
    skipSpecialist: false as const,
    service,
    specialists,
  };
}

export async function selectSpecialist(accountId: number, userId: number, specialistId: number) {
  const specialist = await findSpecialistById(accountId, specialistId);
  const session = await getSessionPayload(accountId, userId);
  const service = session.serviceId
    ? await findServiceById(accountId, session.serviceId, specialistId)
    : null;

  if (!specialist || !specialist.is_active || !service) {
    return { ok: false as const, reason: 'specialist_not_found' };
  }

  await mergeSessionPayload(accountId, userId, UserSessionState.CHOOSING_DATE, {
    specialistId: specialist.id,
  });

  return {
    ok: true as const,
    specialist,
    service,
    dates: await getNextAvailableDates(accountId),
  };
}
