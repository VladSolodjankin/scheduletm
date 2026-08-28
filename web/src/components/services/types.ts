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
  imageMediaId: string | null;
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
  description: string | null;
  basePrice: number;
  baseDurationMinutes: number;
  firstSessionFree: boolean;
  imageMediaId?: string | null;
  isActive: boolean;
  specialistIds: number[];
};

export type AssignmentPayload = {
  isActive: boolean;
  priceOverride: number | null;
  durationOverrideMinutes: number | null;
};

export type ServiceDeleteImpact = {
  canDelete: boolean;
  impact: {
    appointments: number;
    appointmentGroups: number;
    publicPages: number;
  };
};

export type ServiceImageMedia = {
  id: string;
  url: string;
  mimeType: string;
  alt: string;
  width: number;
  height: number;
};
