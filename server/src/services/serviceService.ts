import type { User } from '../types/domain.js';
import { env } from '../config/env.js';
import { WebUserRole } from '../types/webUserRole.js';
import { canManageServices } from '../policies/rolePermissions.js';
import * as repository from '../repositories/serviceRepository.js';
import { findAccountMedia } from '../repositories/publicPageMediaRepository.js';

export class ServiceCatalogError extends Error {
  constructor(
    public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_SPECIALISTS' | 'MEDIA_NOT_FOUND' | 'CONFLICT' | 'SERVICE_IN_USE',
    public impact?: ServiceReferenceImpact,
  ) { super(code); }
}

export type ServiceReferenceImpact = {
  appointments: number;
  appointmentGroups: number;
  publicPages: number;
};

type ServicePayload = {
  name?: string; description?: string | null; basePrice?: number; baseDurationMinutes?: number;
  firstSessionFree?: boolean; imageMediaId?: string | null;
  isActive?: boolean; specialistIds?: number[];
};
type AssignmentPayload = { priceOverride?: number | null; durationOverrideMinutes?: number | null; isActive?: boolean };

export const publicMediaUrl = (mediaId: string) => {
  const url = new URL(`/api/public-pages/media/${mediaId}/content`, env.API_BASE_URL);
  url.protocol = 'https:';
  return url.toString();
};
const toReferenceImpact = (impact: repository.ServiceDeleteImpact): ServiceReferenceImpact => ({
  appointments: impact.appointmentCount,
  appointmentGroups: impact.appointmentGroupCount,
  publicPages: impact.publicPageCount,
});

async function resolveImageMediaId(accountId: number, payload: ServicePayload) {
  if (payload.imageMediaId !== undefined) {
    if (payload.imageMediaId === null) return { image_media_id: null };
    if (!(await findAccountMedia(accountId, payload.imageMediaId))) {
      throw new ServiceCatalogError('MEDIA_NOT_FOUND');
    }
    return { image_media_id: payload.imageMediaId };
  }
  return {};
}

async function getDto(accountId: number, specialistId?: number, manager = false) {
  const services = await repository.listServices(accountId, specialistId);
  const assignments = await repository.listAssignments(accountId, services.map(({ id }) => id));
  return services.map((service) => ({
    id: service.id, name: service.name, description: service.description, basePrice: service.price,
    baseDurationMinutes: service.duration_min, firstSessionFree: service.is_first_free,
    imageUrl: service.is_active && service.image_media_id ? publicMediaUrl(service.image_media_id) : null,
    imageMediaId: service.image_media_id, isActive: service.is_active,
    assignments: assignments.filter((item) => item.serviceId === service.id).map(({ serviceId: _, ...item }) => ({
      ...item,
      canEdit: manager || item.specialistId === specialistId,
    })),
  }));
}

export async function getServicesForActor(actor: User) {
  if (canManageServices(actor.role)) {
    const [services, specialists] = await Promise.all([
      getDto(actor.accountId, undefined, true),
      repository.listSpecialistOptions(actor.accountId),
    ]);
    return { services, specialists };
  }
  if (actor.role !== WebUserRole.Specialist) throw new ServiceCatalogError('FORBIDDEN');
  const specialist = await repository.findSpecialistForUser(actor.accountId, Number(actor.id));
  if (!specialist) return { services: [], specialists: [] };
  const services = await getDto(actor.accountId, specialist.id);
  const specialists = (await repository.listSpecialistOptions(actor.accountId)).filter(({ id }) => id === specialist.id);
  return { services, specialists };
}

export async function createServiceForActor(actor: User, payload: Required<Pick<ServicePayload, 'name' | 'basePrice' | 'baseDurationMinutes'>> & ServicePayload) {
  if (!canManageServices(actor.role)) throw new ServiceCatalogError('FORBIDDEN');
  const activeIds = await repository.listActiveSpecialistIds(actor.accountId);
  let specialistIds = [...new Set(payload.specialistIds ?? [])];
  if (activeIds.length === 1) specialistIds = activeIds;
  if (!(await repository.validateActiveSpecialists(actor.accountId, specialistIds))) throw new ServiceCatalogError('INVALID_SPECIALISTS');
  const isActive = activeIds.length === 0 ? false : (payload.isActive ?? true);
  const image = await resolveImageMediaId(actor.accountId, payload);
  const id = await repository.createService({
    accountId: actor.accountId, name: payload.name, description: payload.description ?? null,
    price: payload.basePrice, duration_min: payload.baseDurationMinutes,
    is_first_free: payload.firstSessionFree ?? false, image_media_id: image.image_media_id ?? null,
    is_active: isActive, specialistIds,
  });
  return (await getDto(actor.accountId, undefined, true)).find((item) => item.id === id);
}

export async function updateServiceForActor(actor: User, id: number, payload: ServicePayload) {
  if (!canManageServices(actor.role)) throw new ServiceCatalogError('FORBIDDEN');
  if (!(await repository.findService(actor.accountId, id))) throw new ServiceCatalogError('NOT_FOUND');
  const specialistIds = payload.specialistIds ? [...new Set(payload.specialistIds)] : undefined;
  if (specialistIds && !(await repository.validateActiveSpecialists(actor.accountId, specialistIds))) throw new ServiceCatalogError('INVALID_SPECIALISTS');
  const image = await resolveImageMediaId(actor.accountId, payload);
  await repository.updateService({
    accountId: actor.accountId, id, name: payload.name, description: payload.description,
    price: payload.basePrice, duration_min: payload.baseDurationMinutes,
    is_first_free: payload.firstSessionFree, ...image, is_active: payload.isActive, specialistIds,
  });
  return (await getDto(actor.accountId, undefined, true)).find((item) => item.id === id);
}

export async function updateAssignmentForActor(actor: User, serviceId: number, specialistId: number, payload: AssignmentPayload) {
  if (!(await repository.findService(actor.accountId, serviceId))) throw new ServiceCatalogError('NOT_FOUND');
  if (!(await repository.validateActiveSpecialists(actor.accountId, [specialistId]))) throw new ServiceCatalogError('NOT_FOUND');
  if (!canManageServices(actor.role)) {
    const own = actor.role === WebUserRole.Specialist
      ? await repository.findSpecialistForUser(actor.accountId, Number(actor.id)) : null;
    if (!own || own.id !== specialistId) throw new ServiceCatalogError('FORBIDDEN');
    if (!(await repository.findAssignment(actor.accountId, serviceId, specialistId))) throw new ServiceCatalogError('NOT_FOUND');
  }
  await repository.upsertAssignment({ accountId: actor.accountId, serviceId, specialistId, ...payload });
  const own = actor.role === WebUserRole.Specialist
    ? await repository.findSpecialistForUser(actor.accountId, Number(actor.id)) : null;
  return (await getDto(actor.accountId, own?.id, canManageServices(actor.role))).find((item) => item.id === serviceId);
}

export async function getServiceDeleteImpactForActor(actor: User, serviceId: number) {
  if (!canManageServices(actor.role)) throw new ServiceCatalogError('FORBIDDEN');
  const impact = await repository.getServiceDeleteImpact(actor.accountId, serviceId);
  if (!impact) throw new ServiceCatalogError('NOT_FOUND');
  return { canDelete: impact.canDelete, impact: toReferenceImpact(impact) };
}

export async function deleteServiceForActor(actor: User, serviceId: number) {
  if (!canManageServices(actor.role)) throw new ServiceCatalogError('FORBIDDEN');
  const result = await repository.deleteService(actor.accountId, serviceId);
  if (result.status === 'not_found') throw new ServiceCatalogError('NOT_FOUND');
  if (result.status === 'in_use') {
    throw new ServiceCatalogError('SERVICE_IN_USE', toReferenceImpact(result.impact));
  }
  return toReferenceImpact(result.impact);
}
