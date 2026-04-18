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

export async function startBooking(userId: number) {
  await updateSessionState(userId, UserSessionState.CHOOSING_SERVICE, {});
  return findActiveServices();
}

export async function selectService(userId: number, serviceId: number) {
  const service = await findServiceById(serviceId);
  if (!service || !service.is_active) {
    return { ok: false as const, reason: 'service_not_found' };
  }

  await mergeSessionPayload(userId, UserSessionState.CHOOSING_SPECIALIST, {
    serviceId: service.id,
  });

  const defaultSpecialist = await findSingleDefaultActiveSpecialist();

  if (defaultSpecialist) {
    await mergeSessionPayload(userId, UserSessionState.CHOOSING_DATE, {
      serviceId: service.id,
      specialistId: defaultSpecialist.id,
    });

    return {
      ok: true as const,
      skipSpecialist: true as const,
      service,
      specialist: defaultSpecialist,
      dates: getNextAvailableDates(),
    };
  }

  const specialists = await findActiveSpecialists();

  return {
    ok: true as const,
    skipSpecialist: false as const,
    service,
    specialists,
  };
}

export async function selectSpecialist(userId: number, specialistId: number) {
  const specialist = await findSpecialistById(specialistId);

  if (!specialist || !specialist.is_active) {
    return { ok: false as const, reason: 'specialist_not_found' };
  }

  await mergeSessionPayload(userId, UserSessionState.CHOOSING_DATE, {
    specialistId: specialist.id,
  });

  return {
    ok: true as const,
    specialist,
    dates: getNextAvailableDates(),
  };
}
