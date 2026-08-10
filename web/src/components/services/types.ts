export type ServiceAssignment = {
  specialistId: number;
  specialistName: string;
  isActive: boolean;
  priceOverride: number | null;
  durationOverrideMinutes: number | null;
  canEdit?: boolean;
};

export type ServiceCatalogItem = {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  baseDurationMinutes: number;
  firstSessionFree: boolean;
  imageUrl: string | null;
  isActive: boolean;
  assignments: ServiceAssignment[];
};

export type ServiceSpecialist = {
  id: number;
  name: string;
  isActive?: boolean;
};

export type ServicesResponse = {
  services: ServiceCatalogItem[];
  specialists: ServiceSpecialist[];
};

export type ServicePayload = {
  name: string;
  description?: string;
  basePrice: number;
  baseDurationMinutes: number;
  firstSessionFree: boolean;
  imageUrl?: string;
  isActive: boolean;
  specialistIds: number[];
};

export type AssignmentPayload = {
  isActive: boolean;
  priceOverride: number | null;
  durationOverrideMinutes: number | null;
};
