import crypto from 'node:crypto';
import type { Response } from 'express';
import { env } from '../config/env.js';
import { clearLoginAttempt, findLoginAttemptByIp, upsertFailedLoginAttempt } from '../repositories/loginAttemptRepository.js';
import { createAccount } from '../repositories/accountRepository.js';
import { createDefaultSpecialistForWebUserIfMissing, createSpecialistForWebUser } from '../repositories/specialistRepository.js';
import {
  createWebUser,
  findWebUserByEmailAnyAccount,
  findWebUserById,
  findWebUserByIdAnyAccount,
  touchWebUserLastLogin,
  updateWebUserAuthState,
  updateWebUserCredentials,
  updateWebUserSettings,
} from '../repositories/webUserRepository.js';
import {
  createWebUserSession,
  deleteWebUserSessionByTokenAnyAccount,
  findActiveWebUserSessionByTokenAnyAccount,
  revokeWebUserSessionByTokenAnyAccount,
} from '../repositories/webUserSessionRepository.js';
import type { User } from '../types/domain.js';
import { WebUserRole } from '../types/webUserRole.js';
import { canManageSpecialists } from '../policies/rolePermissions.js';
import { createToken, hashPassword, sanitizeEmail, verifyPassword } from '../utils/crypto.js';
import { sendEmailVerificationEmail, sendRegistrationSuccessEmail } from './emailDeliveryService.js';

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

export const issueSession = async (user: Pick<User, 'id' | 'accountId'>, res: Response) => {
  const numericUserId = Number(user.id);
  if (!Number.isInteger(numericUserId)) {
    throw new Error('Invalid web user id for session issue');
  }
  if (!Number.isInteger(user.accountId)) {
    throw new Error('Invalid account id for session issue');
  }

  const accessToken = createToken();
  const refreshToken = createToken();
  const accessExpiresAt = new Date(now() + accessExpiresMs);
  const refreshExpiresAt = new Date(now() + cookieExpiresMs);

  await createWebUserSession({
    accountId: user.accountId,
    webUserId: numericUserId,
    token: accessToken,
    sessionType: 'access',
    expiresAt: accessExpiresAt
  });
  await createWebUserSession({
    accountId: user.accountId,
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
  const existing = await findWebUserByEmailAnyAccount(email);
  if (existing) {
    if (existing.email_verified_at) {
      return null;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const verificationCode = createToken();

    await updateWebUserCredentials(existing.account_id, existing.id, passwordHash, salt);
    await updateWebUserAuthState({
      accountId: existing.account_id,
      id: existing.id,
      emailVerificationCode: verificationCode,
      emailVerificationSentAt: new Date(),
    });

    await sendEmailVerificationEmail({
      to: email,
      verificationCode,
      firstName: existing.first_name ?? undefined,
    });

    return mapWebUserToDomain(
      existing.id,
      existing.account_id,
      existing.email,
      existing.role,
      salt,
      passwordHash,
      existing.created_at,
    );
  }

  const accountCode = `acc-${crypto.randomUUID()}`;
  const accountName = email.split('@')[0]?.trim() || email;
  const accountId = await createAccount({
    code: accountCode,
    name: accountName,
  });

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const verificationCode = createToken();

  const webUser = await createWebUser({
    accountId,
    email,
    role: WebUserRole.Admin,
    passwordHash,
    passwordSalt: salt,
    timezone,
    emailVerificationCode: verificationCode,
    emailVerificationSentAt: new Date(),
  });

  await createDefaultSpecialistForWebUserIfMissing(accountId, webUser.id, email);

  await sendEmailVerificationEmail({
    to: email,
    verificationCode,
  });

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

export const resendUserEmailVerificationCode = async (emailRaw: string): Promise<boolean> => {
  const email = sanitizeEmail(emailRaw);
  const user = await findWebUserByEmailAnyAccount(email);
  if (!user) {
    return false;
  }

  if (user.email_verified_at) {
    return true;
  }

  const verificationCode = createToken();

  await updateWebUserAuthState({
    accountId: user.account_id,
    id: user.id,
    emailVerificationCode: verificationCode,
    emailVerificationSentAt: new Date(),
  });

  await sendEmailVerificationEmail({
    to: user.email,
    verificationCode,
    firstName: user.first_name ?? undefined,
  });

  return true;
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
  const accountId = actor.accountId;
  const existing = await findWebUserByEmailAnyAccount(email);
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
  const user = await findWebUserByEmailAnyAccount(email);
  if (!user) {
    return null;
  }

  const isValid = verifyPassword(password, user.password_salt, user.password_hash);
  if (!isValid) {
    return null;
  }

  if (!user.email_verified_at) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  const accountId = user.account_id;

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

export const verifyUserEmail = async (emailRaw: string, verificationCodeRaw: string): Promise<boolean> => {
  const email = sanitizeEmail(emailRaw);
  const verificationCode = verificationCodeRaw.trim();
  if (!verificationCode) {
    return false;
  }

  const user = await findWebUserByEmailAnyAccount(email);
  if (!user) {
    return false;
  }

  if (user.email_verified_at) {
    return true;
  }

  if (user.email_verification_code !== verificationCode) {
    return false;
  }

  await updateWebUserAuthState({
    accountId: user.account_id,
    id: user.id,
    emailVerifiedAt: new Date(),
    emailVerificationCode: null,
  });

  await sendRegistrationSuccessEmail({
    to: user.email,
    firstName: user.first_name ?? undefined,
  });

  return true;
};

export const refreshAccess = async (refreshToken: string) => {
  const current = await findActiveWebUserSessionByTokenAnyAccount(refreshToken, 'refresh');
  if (!current) {
    return null;
  }

  await revokeWebUserSessionByTokenAnyAccount(refreshToken);
  return {
    userId: String(current.web_user_id),
    accountId: current.account_id,
  };
};

export const resolveUserByAccessToken = async (token: string): Promise<User | null> => {
  const session = await findActiveWebUserSessionByTokenAnyAccount(token, 'access');
  if (!session) {
    return null;
  }

  const user = await findWebUserByIdAnyAccount(session.web_user_id);
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
  if (refreshToken) {
    await deleteWebUserSessionByTokenAnyAccount(refreshToken);
  }

  if (accessToken) {
    await deleteWebUserSessionByTokenAnyAccount(accessToken);
  }
};
