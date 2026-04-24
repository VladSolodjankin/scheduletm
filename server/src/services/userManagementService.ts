import crypto from 'node:crypto';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { createClient } from '../repositories/clientRepository.js';
import { deactivateSpecialistByWebUserId } from '../repositories/specialistRepository.js';
import {
  createWebUser,
  findWebUserByEmail,
  findWebUserById,
  listWebUsersByAccount,
  updateWebUserProfile,
} from '../repositories/webUserRepository.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { generateTemporaryPassword, hashPassword, sanitizeEmail } from '../utils/crypto.js';
import { sendWelcomePasswordEmail } from './emailDeliveryService.js';

export type UserManagementItem = {
  id: number;
  email: string;
  role: WebUserRole;
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
  isActive: boolean;
  createdAt: string;
};

type UserCreatePayload = {
  email: string;
  role: "admin" | "specialist" | "client";
  firstName: string;
  lastName: string;
  phone?: string;
  telegramUsername?: string;
};

type UserUpdatePayload = {
  email: string;
  role: "admin" | "specialist" | "client";
  firstName: string;
  lastName: string;
  phone?: string;
  telegramUsername?: string;
};

const canManageFullUserDirectory = (role: WebUserRole): boolean =>
  role === WebUserRole.Owner || role === WebUserRole.Admin;

const canManageClients = (role: WebUserRole): boolean =>
  canManageFullUserDirectory(role) || role === WebUserRole.Specialist;

const canCreateRole = (actorRole: WebUserRole, targetRole: UserCreatePayload['role']): boolean => {
  if (targetRole === WebUserRole.Client) {
    return canManageClients(actorRole);
  }

  return canManageFullUserDirectory(actorRole);
};

const mapUser = (item: Awaited<ReturnType<typeof listWebUsersByAccount>>[number]): UserManagementItem => ({
  id: item.id,
  email: item.email,
  role: item.role,
  firstName: item.first_name ?? '',
  lastName: item.last_name ?? '',
  phone: item.phone ?? '',
  telegramUsername: item.telegram_username ?? '',
  isActive: item.is_active,
  createdAt: item.created_at.toISOString(),
});

async function resolveAccountId(actor: User): Promise<number> {
  return actor.accountId || getDefaultAccountId();
}

export async function listManagedUsers(actor: User): Promise<UserManagementItem[]> {
  if (!canManageClients(actor.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const users = await listWebUsersByAccount(accountId);
  const filtered = canManageFullUserDirectory(actor.role)
    ? users
    : users.filter((item) => item.role === WebUserRole.Client);
  return filtered.map(mapUser);
}

export async function createManagedUser(actor: User, payload: UserCreatePayload): Promise<UserManagementItem> {
  if (!canCreateRole(actor.role, payload.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const email = sanitizeEmail(payload.email);

  const existing = await findWebUserByEmail(accountId, email);
  if (existing) {
    throw new Error('EMAIL_IN_USE');
  }

  const temporaryPassword = generateTemporaryPassword();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(temporaryPassword, salt);

  const created = await createWebUser({
    accountId,
    email,
    role: payload.role as WebUserRole,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    phone: payload.phone?.trim(),
    telegramUsername: payload.telegramUsername?.trim(),
    passwordHash,
    passwordSalt: salt,
  });

  if (payload.role === WebUserRole.Client) {
    const client = await createClient({
      accountId,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone?.trim(),
      email,
      username: payload.telegramUsername?.trim(),
    });

    await updateWebUserProfile({
      accountId,
      id: created.id,
      clientId: client.id,
    });
  }

  await sendWelcomePasswordEmail({
    to: email,
    firstName: payload.firstName.trim(),
    temporaryPassword,
  });

  return mapUser(created);
}

export async function updateManagedUser(actor: User, userId: number, payload: UserUpdatePayload): Promise<UserManagementItem | null> {
  if (!canManageClients(actor.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const existing = await findWebUserById(accountId, userId);
  if (!existing) {
    return null;
  }
  if (!canManageFullUserDirectory(actor.role)) {
    if (existing.role !== WebUserRole.Client || payload.role !== WebUserRole.Client) {
      throw new Error('FORBIDDEN');
    }
  }

  const email = sanitizeEmail(payload.email);
  if (email !== existing.email) {
    const duplicate = await findWebUserByEmail(accountId, email);
    if (duplicate && duplicate.id !== userId) {
      throw new Error('EMAIL_IN_USE');
    }
  }

  await updateWebUserProfile({
    accountId,
    id: userId,
    email,
    role: payload.role as WebUserRole,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    phone: payload.phone?.trim() ?? '',
    telegramUsername: payload.telegramUsername?.trim() ?? '',
  });

  const updated = await findWebUserById(accountId, userId);
  return updated ? mapUser(updated) : null;
}

export async function deactivateManagedUser(actor: User, userId: number): Promise<UserManagementItem | null> {
  if (!canManageClients(actor.role)) {
    throw new Error('FORBIDDEN');
  }

  const accountId = await resolveAccountId(actor);
  const existing = await findWebUserById(accountId, userId);
  if (!existing) {
    return null;
  }
  if (!canManageFullUserDirectory(actor.role) && existing.role !== WebUserRole.Client) {
    throw new Error('FORBIDDEN');
  }

  await updateWebUserProfile({
    accountId,
    id: userId,
    isActive: false,
  });
  await deactivateSpecialistByWebUserId(accountId, userId);

  const updated = await findWebUserById(accountId, userId);
  return updated ? mapUser(updated) : null;
}
