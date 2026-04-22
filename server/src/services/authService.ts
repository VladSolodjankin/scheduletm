import crypto from 'node:crypto';
import type { Response } from 'express';
import { env } from '../config/env.js';
import { clearLoginAttempt, findLoginAttemptByIp, upsertFailedLoginAttempt } from '../repositories/loginAttemptRepository.js';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { createDefaultSpecialistForWebUserIfMissing, createSpecialistForWebUser } from '../repositories/specialistRepository.js';
import {
  createWebUser,
  findWebUserByEmail,
  findWebUserById,
  touchWebUserLastLogin,
  updateWebUserSettings,
} from '../repositories/webUserRepository.js';
import {
  createWebUserSession,
  deleteWebUserSessionByToken,
  findActiveWebUserSessionByToken,
  revokeWebUserSessionByToken
} from '../repositories/webUserSessionRepository.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { createToken, hashPassword, sanitizeEmail, verifyPassword } from '../utils/crypto.js';

const now = () => Date.now();
const cookieExpiresMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const accessExpiresMs = env.ACCESS_TOKEN_TTL_SECONDS * 1000;

export const isLockedIp = async (ip: string) => {
  const attempt = await findLoginAttemptByIp(ip);
  return Boolean(attempt?.locked_until && attempt.locked_until.getTime() > now());
};

export const registerFailedAttempt = async (ip: string) => {
  const current = await findLoginAttemptByIp(ip);
  const currentCount = current?.fail_count ?? 0;
  const nextCount = currentCount + 1;
  const lockForMs = nextCount >= 5 ? 15 * 60 * 1000 : 0;

  await upsertFailedLoginAttempt(ip, lockForMs > 0 ? new Date(now() + lockForMs) : null);
};

export const clearAttempts = async (ip: string) => clearLoginAttempt(ip);

export const issueSession = async (userId: string, res: Response) => {
  const accountId = await getDefaultAccountId();
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) {
    throw new Error('Invalid web user id for session issue');
  }

  const accessToken = createToken();
  const refreshToken = createToken();
  const accessExpiresAt = new Date(now() + accessExpiresMs);
  const refreshExpiresAt = new Date(now() + cookieExpiresMs);

  await createWebUserSession({
    accountId,
    webUserId: numericUserId,
    token: accessToken,
    sessionType: 'access',
    expiresAt: accessExpiresAt
  });
  await createWebUserSession({
    accountId,
    webUserId: numericUserId,
    token: refreshToken,
    sessionType: 'refresh',
    expiresAt: refreshExpiresAt
  });

  res.cookie(env.SESSION_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: cookieExpiresMs,
    path: '/api/auth'
  });

  return accessToken;
};

const mapWebUserToDomain = (
  id: number,
  accountId: number,
  email: string,
  role: WebUserRole,
  passwordSalt: string,
  passwordHash: string,
  createdAt: Date,
): User => {
  return {
    id: String(id),
    accountId,
    email,
    role,
    passwordSalt,
    passwordHash,
    createdAt: createdAt.toISOString()
  };
};

export const registerUser = async (
  emailRaw: string,
  password: string,
  timezone?: string,
): Promise<User | null> => {
  const email = sanitizeEmail(emailRaw);
  const accountId = await getDefaultAccountId();

  const existing = await findWebUserByEmail(accountId, email);
  if (existing) {
    return null;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const webUser = await createWebUser({
    accountId,
    email,
    role: WebUserRole.Owner,
    passwordHash,
    passwordSalt: salt,
    timezone,
  });

  await createDefaultSpecialistForWebUserIfMissing(accountId, webUser.id, email);

  return mapWebUserToDomain(
    webUser.id,
    webUser.account_id,
    webUser.email,
    webUser.role,
    webUser.password_salt,
    webUser.password_hash,
    webUser.created_at
  );
};

const canManageSpecialists = (role: WebUserRole): boolean => {
  return role === WebUserRole.Owner || role === WebUserRole.Admin;
};

const buildSpecialistCode = (webUserId: number): string => {
  return `specialist-${webUserId}`;
};

export const createSpecialistUser = async (
  actor: User,
  emailRaw: string,
  password: string,
  specialistName: string,
): Promise<{ user: User; specialistId: number } | null> => {
  if (!canManageSpecialists(actor.role)) {
    return null;
  }

  const email = sanitizeEmail(emailRaw);
  const accountId = await getDefaultAccountId();
  const existing = await findWebUserByEmail(accountId, email);
  if (existing) {
    return null;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const webUser = await createWebUser({
    accountId,
    email,
    role: WebUserRole.Specialist,
    passwordHash,
    passwordSalt: salt,
  });

  const specialistId = await createSpecialistForWebUser({
    accountId,
    webUserId: webUser.id,
    name: specialistName.trim(),
    code: buildSpecialistCode(webUser.id),
  });

  const user = mapWebUserToDomain(
    webUser.id,
    webUser.account_id,
    webUser.email,
    webUser.role,
    webUser.password_salt,
    webUser.password_hash,
    webUser.created_at,
  );

  return { user, specialistId };
};

export const authenticateUser = async (
  emailRaw: string,
  password: string,
  timezone?: string,
): Promise<User | null> => {
  const email = sanitizeEmail(emailRaw);
  const accountId = await getDefaultAccountId();
  const user = await findWebUserByEmail(accountId, email);
  if (!user) {
    return null;
  }

  const isValid = verifyPassword(password, user.password_salt, user.password_hash);
  if (!isValid) {
    return null;
  }

  if (timezone && timezone !== user.timezone) {
    await updateWebUserSettings({
      accountId,
      id: user.id,
      timezone,
    });
  }

  await touchWebUserLastLogin(accountId, user.id);
  return mapWebUserToDomain(
    user.id,
    user.account_id,
    user.email,
    user.role,
    user.password_salt,
    user.password_hash,
    user.created_at
  );
};

export const refreshAccess = async (refreshToken: string) => {
  const accountId = await getDefaultAccountId();
  const current = await findActiveWebUserSessionByToken(accountId, refreshToken, 'refresh');
  if (!current) {
    return null;
  }

  await revokeWebUserSessionByToken(accountId, refreshToken);
  return String(current.web_user_id);
};

export const resolveUserByAccessToken = async (token: string): Promise<User | null> => {
  const accountId = await getDefaultAccountId();
  const session = await findActiveWebUserSessionByToken(accountId, token, 'access');
  if (!session) {
    return null;
  }

  const user = await findWebUserById(accountId, session.web_user_id);
  if (!user) {
    return null;
  }

  return mapWebUserToDomain(
    user.id,
    user.account_id,
    user.email,
    user.role,
    user.password_salt,
    user.password_hash,
    user.created_at
  );
};

export const logoutSession = async (refreshToken?: string, accessToken?: string) => {
  const accountId = await getDefaultAccountId();

  if (refreshToken) {
    await deleteWebUserSessionByToken(accountId, refreshToken);
  }

  if (accessToken) {
    await deleteWebUserSessionByToken(accountId, accessToken);
  }
};
