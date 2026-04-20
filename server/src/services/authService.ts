import crypto from 'node:crypto';
import type { Response } from 'express';
import { env } from '../config/env.js';
import {
  accessSessions,
  loginAttempts,
  refreshSessions
} from '../repositories/inMemoryStore.js';
import { getDefaultAccountId } from '../repositories/accountRepository.js';
import { createDefaultSpecialistForWebUserIfMissing } from '../repositories/specialistRepository.js';
import { createIdentityLinkIfMissing, findTelegramUserByEmail } from '../repositories/userIdentityLinkRepository.js';
import { createWebUser, findWebUserByEmail, findWebUserById, touchWebUserLastLogin } from '../repositories/webUserRepository.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { createToken, hashPassword, sanitizeEmail, verifyPassword } from '../utils/crypto.js';

const now = () => Date.now();
const cookieExpiresMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const accessExpiresMs = env.ACCESS_TOKEN_TTL_SECONDS * 1000;

export const isLockedIp = (ip: string) => {
  const attempt = loginAttempts.get(ip);
  return Boolean(attempt && attempt.lockedUntil > now());
};

export const registerFailedAttempt = (ip: string) => {
  const current = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  const nextCount = current.count + 1;
  const lockForMs = nextCount >= 5 ? 15 * 60 * 1000 : 0;

  loginAttempts.set(ip, {
    count: lockForMs > 0 ? 0 : nextCount,
    lockedUntil: lockForMs > 0 ? now() + lockForMs : 0
  });
};

export const clearAttempts = (ip: string) => loginAttempts.delete(ip);

export const issueSession = (userId: string, res: Response) => {
  const accessToken = createToken();
  const refreshToken = createToken();

  accessSessions.set(accessToken, { userId, expiresAt: now() + accessExpiresMs });
  refreshSessions.set(refreshToken, { userId, expiresAt: now() + cookieExpiresMs });

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
  email: string,
  role: WebUserRole,
  passwordSalt: string,
  passwordHash: string,
  createdAt: Date,
): User => {
  return {
    id: String(id),
    email,
    role,
    passwordSalt,
    passwordHash,
    createdAt: createdAt.toISOString()
  };
};

const tryLinkTelegramIdentity = async (accountId: number, email: string, webUserId: number) => {
  const telegramUser = await findTelegramUserByEmail(accountId, email);
  if (!telegramUser) {
    return;
  }

  await createIdentityLinkIfMissing(accountId, telegramUser.id, webUserId);
};

export const registerUser = async (emailRaw: string, password: string): Promise<User | null> => {
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
    passwordSalt: salt
  });

  await createDefaultSpecialistForWebUserIfMissing(accountId, webUser.id, email);
  await tryLinkTelegramIdentity(accountId, email, webUser.id);

  return mapWebUserToDomain(
    webUser.id,
    webUser.email,
    webUser.role,
    webUser.password_salt,
    webUser.password_hash,
    webUser.created_at
  );
};

export const authenticateUser = async (emailRaw: string, password: string): Promise<User | null> => {
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

  await touchWebUserLastLogin(accountId, user.id);
  return mapWebUserToDomain(user.id, user.email, user.role, user.password_salt, user.password_hash, user.created_at);
};

export const refreshAccess = (refreshToken: string) => {
  const current = refreshSessions.get(refreshToken);
  if (!current || current.expiresAt < now()) {
    return null;
  }

  refreshSessions.delete(refreshToken);
  return current.userId;
};

export const resolveUserByAccessToken = async (token: string): Promise<User | null> => {
  const session = accessSessions.get(token);
  if (!session || session.expiresAt < now()) {
    return null;
  }

  const accountId = await getDefaultAccountId();
  const userId = Number(session.userId);
  if (!Number.isInteger(userId)) {
    return null;
  }

  const user = await findWebUserById(accountId, userId);
  if (!user) {
    return null;
  }

  return mapWebUserToDomain(user.id, user.email, user.role, user.password_salt, user.password_hash, user.created_at);
};
