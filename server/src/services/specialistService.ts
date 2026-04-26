import {
  createSpecialist,
  deactivateSpecialistById,
  findSpecialistById,
  listSpecialistsAllAccounts,
  listSpecialistsByAccount,
  updateSpecialistById,
} from '../repositories/specialistRepository.js';
import { findWebUserById, listActiveSpecialistWebUsersWithoutProfile } from '../repositories/webUserRepository.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { canManageSpecialistSettings, canManageSpecialists } from '../policies/rolePermissions.js';
import { upsertSpecialistSettingsBySpecialistId } from '../repositories/specialistSettingsRepository.js';

type SpecialistDto = {
  id: number;
  name: string;
  code: string;
  timezone: string;
  isActive: boolean;
  slotStepMin: number;
  baseSessionPrice: number;
  baseHourPrice: number;
  workStartHour: number;
  workEndHour: number;
  slotDurationMin: number;
  defaultSessionContinuationMin: number;
};

type SpecialistCreatePayload = {
  userId: number;
};

type SpecialistUpdatePayload = {
  name?: string;
  isActive?: boolean;
  baseSessionPrice?: number;
  baseHourPrice?: number;
  workStartHour?: number;
  workEndHour?: number;
  slotDurationMin?: number;
  slotStepMin?: number;
  defaultSessionContinuationMin?: number;
};

export type SpecialistWebUserOptionDto = {
  id: number;
  email: string;
};
const mapSpecialist = (item: Awaited<ReturnType<typeof listSpecialistsByAccount>>[number]): SpecialistDto => ({
  id: item.id,
  name: item.name,
  code: item.code,
  timezone: item.timezone || 'UTC',
  isActive: item.is_active,
  slotStepMin: item.slot_step_min ?? 30,
  baseSessionPrice: item.base_session_price ?? 0,
  baseHourPrice: item.base_hour_price ?? 0,
  workStartHour: item.work_start_hour ?? 9,
  workEndHour: item.work_end_hour ?? 20,
  slotDurationMin: item.slot_duration_min ?? 90,
  defaultSessionContinuationMin: item.default_session_continuation_min ?? item.slot_duration_min ?? 90,
});

const buildSpecialistCode = (name: string): string => {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'specialist';

  return `${normalized}-${Date.now()}`;
};

async function resolveAccountId(actor: User): Promise<number> {
  return actor.accountId;
}

export async function getSpecialistsForActor(actor: User): Promise<SpecialistDto[]> {
  const accountId = await resolveAccountId(actor);

  if (actor.role === WebUserRole.Owner) {
    return (await listSpecialistsAllAccounts()).map(mapSpecialist);
  }

  if (canManageSpecialists(actor.role)) {
    return (await listSpecialistsByAccount(accountId)).map(mapSpecialist);
  }

  return (await listSpecialistsByAccount(accountId))
    .filter((item) => item.user_id === Number(actor.id))
    .map(mapSpecialist);
}

export async function getAvailableSpecialistWebUsersForActor(actor: User): Promise<SpecialistWebUserOptionDto[]> {
  if (!canManageSpecialists(actor.role)) {
    return [];
  }

  const accountId = await resolveAccountId(actor);
  return listActiveSpecialistWebUsersWithoutProfile(accountId);
}

export async function createSpecialistForActor(actor: User, payload: SpecialistCreatePayload): Promise<SpecialistDto> {
  if (!canManageSpecialists(actor.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const webUser = await findWebUserById(accountId, payload.userId);
  if (!webUser || webUser.role !== WebUserRole.Specialist || !webUser.is_active) {
    throw new Error('WEB_USER_NOT_AVAILABLE');
  }

  const id = await createSpecialist({
    accountId,
    name: webUser.email,
    code: buildSpecialistCode(webUser.email),
    userId: payload.userId,
  });

  await upsertSpecialistSettingsBySpecialistId({
    accountId,
    specialistId: id,
  });

  const created = await findSpecialistById(accountId, id);
  if (!created) {
    throw new Error('CREATE_FAILED');
  }

  return mapSpecialist(created);
}

export async function updateSpecialistForActor(
  actor: User,
  specialistId: number,
  payload: SpecialistUpdatePayload,
): Promise<SpecialistDto | null> {
  if (!canManageSpecialistSettings(actor.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const existing = await findSpecialistById(accountId, specialistId);
  if (!existing) {
    return null;
  }

  const isManager = canManageSpecialists(actor.role);
  const isOwnSpecialist = existing.user_id === Number(actor.id);

  if (!isManager && !isOwnSpecialist) {
    throw new Error('FORBIDDEN');
  }

  if (isManager) {
    await updateSpecialistById(accountId, specialistId, {
      name: payload.name,
      isActive: payload.isActive,
    });
  }

  await upsertSpecialistSettingsBySpecialistId({
    accountId,
    specialistId,
    baseSessionPrice: payload.baseSessionPrice,
    baseHourPrice: payload.baseHourPrice,
    workStartHour: payload.workStartHour,
    workEndHour: payload.workEndHour,
    slotDurationMin: payload.slotDurationMin,
    slotStepMin: payload.slotStepMin,
    defaultSessionContinuationMin: payload.defaultSessionContinuationMin,
  });

  const updated = await findSpecialistById(accountId, specialistId);
  if (!updated) {
    return null;
  }

  return mapSpecialist(updated);
}

export async function deleteSpecialistForActor(actor: User, specialistId: number): Promise<SpecialistDto | null> {
  if (!canManageSpecialists(actor.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const existing = await findSpecialistById(accountId, specialistId);
  if (!existing) {
    return null;
  }

  await deactivateSpecialistById(accountId, specialistId);

  const updated = await findSpecialistById(accountId, specialistId);
  if (!updated) {
    return null;
  }

  return mapSpecialist(updated);
}
