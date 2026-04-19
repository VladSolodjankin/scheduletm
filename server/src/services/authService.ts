import crypto from 'node:crypto';
import type { Response } from 'express';
import { env } from '../config/env.js';
import {
  accessSessions,
  defaultSettings,
  loginAttempts,
  refreshSessions,
  settingsByUserId,
  usersByEmail
} from '../repositories/inMemoryStore.js';
import type { User } from '../types/domain.js';
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

export const registerUser = (emailRaw: string, password: string): User | null => {
  const email = sanitizeEmail(emailRaw);
  if (usersByEmail.has(email)) {
    return null;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const user: User = {
    id: crypto.randomUUID(),
    email,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString()
  };

  usersByEmail.set(email, user);
  settingsByUserId.set(user.id, { ...defaultSettings });
  return user;
};

export const authenticateUser = (emailRaw: string, password: string): User | null => {
  const email = sanitizeEmail(emailRaw);
  const user = usersByEmail.get(email);
  if (!user) {
    return null;
  }

  return verifyPassword(password, user.passwordSalt, user.passwordHash) ? user : null;
};

export const refreshAccess = (refreshToken: string) => {
  const current = refreshSessions.get(refreshToken);
  if (!current || current.expiresAt < now()) {
    return null;
  }

  refreshSessions.delete(refreshToken);
  return current.userId;
};

export const resolveUserByAccessToken = (token: string): User | null => {
  const session = accessSessions.get(token);
  if (!session || session.expiresAt < now()) {
    return null;
  }

  return [...usersByEmail.values()].find((item) => item.id === session.userId) ?? null;
};
