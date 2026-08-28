import type { ServiceCatalogItem, ServicesResponse } from '../../../components/services/types';
import type { PublicBookingService } from '../../../shared/types/api';
import type { BlockContent, ServicesBlockContent } from '../types/publicPage';

export const MAX_PUBLIC_PAGE_SERVICES = 12;

export function normalizeServicesContent(content: BlockContent): BlockContent {
  const serviceIds = Array.isArray(content.serviceIds)
    ? [...new Set(content.serviceIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0))]
      .slice(0, MAX_PUBLIC_PAGE_SERVICES)
    : [];
  const interval = content.autoplayIntervalSeconds;
  const normalized: ServicesBlockContent = {
    title: typeof content.title === 'string' ? content.title : '',
    serviceIds,
    autoplayIntervalSeconds: Number.isInteger(interval) && Number(interval) >= 3 && Number(interval) <= 30
      ? Number(interval) : null,
    showBookingButton: typeof content.showBookingButton === 'boolean' ? content.showBookingButton : true,
  };
  return normalized;
}

export function validateServicesBlockContent(content: BlockContent): string[] {
  const normalized = normalizeServicesContent(content) as ServicesBlockContent;
  return normalized.serviceIds.length > 0 ? [] : ['serviceIds must contain at least one service'];
}

export function isServiceSelectable(service: ServiceCatalogItem, response: ServicesResponse): boolean {
  if (!service.isActive) {
    return false;
  }
  const activeSpecialists = new Set(response.specialists.filter((specialist) => specialist.isActive !== false).map(({ id }) => id));
  return service.assignments.some((assignment) => assignment.isActive && activeSpecialists.has(assignment.specialistId));
}

export function catalogServicesForPreview(response: ServicesResponse | null): PublicBookingService[] {
  if (!response) {
    return [];
  }
  return response.services.filter((service) => isServiceSelectable(service, response)).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    durationMin: service.baseDurationMinutes,
    price: service.basePrice,
    currency: 'RUB',
    firstSessionFree: service.firstSessionFree,
    imageUrl: service.imageUrl,
  }));
}
