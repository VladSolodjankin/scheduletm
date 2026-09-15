import { WebUserRole } from '../types/webUserRole.js';

export const isClientRole = (role: WebUserRole): boolean => role === WebUserRole.Client;

export const canManageSystemSettings = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin;

export const canManageAccountSettings = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin || role === WebUserRole.Owner;

export const canManageSpecialists = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin || role === WebUserRole.Owner;

export const canManageServices = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin || role === WebUserRole.Owner;

export const canReadAccountMedia = (role: WebUserRole): boolean =>
  canManageAccountSettings(role) || role === WebUserRole.Specialist;

export const canManageSpecialistSettings = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin
  || role === WebUserRole.Owner
  || role === WebUserRole.Specialist;

export const canManageAllAppointments = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin || role === WebUserRole.Owner;

export const canManageFullUserDirectory = (role: WebUserRole): boolean =>
  role === WebUserRole.ProductAdmin || role === WebUserRole.Owner;

export const canManageClients = (role: WebUserRole): boolean =>
  canManageFullUserDirectory(role) || role === WebUserRole.Specialist;

export const canCreateUserRole = (actorRole: WebUserRole, targetRole: WebUserRole): boolean => {
  if (targetRole === WebUserRole.ProductAdmin || targetRole === WebUserRole.Owner) {
    return false;
  }

  if (targetRole === WebUserRole.Client) {
    return canManageClients(actorRole);
  }

  return canManageFullUserDirectory(actorRole);
};

export const canCreateAppointments = (_role: WebUserRole): boolean => true;

export const canMarkPaidAndNotify = (role: WebUserRole): boolean => !isClientRole(role);
