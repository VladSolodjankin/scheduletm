import { findActiveServices } from '../repositories/service.repository';
import { updateSessionState } from '../repositories/user-session.repository';
import { UserSessionState } from '../types/session';

export async function startBooking(userId: number) {
  const services = await findActiveServices();

  await updateSessionState(userId, UserSessionState.CHOOSING_SERVICE, {});

  return services;
}
