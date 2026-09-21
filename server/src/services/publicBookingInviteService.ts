import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { createToken, hashPassword, sanitizeEmail } from '../utils/crypto.js';
import {
  createWebUser,
  findWebUserByAccountAndClientId,
  findWebUserByEmailAnyAccount,
  updateWebUserAuthState,
  updateWebUserProfile,
} from '../repositories/webUserRepository.js';
import { WebUserRole } from '../types/webUserRole.js';
import { sendManagedUserInviteEmail } from './emailDeliveryService.js';

function buildInviteLink(email: string, token: string): string {
  return `${env.EMAIL_VERIFY_BASE_URL.replace(/\/+$/, '')}/invite/accept?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
}

export type EnsurePublicBookingClientInviteInput = {
  accountId: number;
  clientId: number;
  email: string;
  firstName: string;
  lastName: string;
  telegramUsername?: string | null;
  timezone?: string | null;
};

/**
 * Invites a guest who just booked through the public page to create a web account,
 * mirroring the Telegram bot's ensureClientWebUserInvite so both booking channels
 * lead to the same client onboarding experience.
 */
export async function ensurePublicBookingClientInvite(input: EnsurePublicBookingClientInviteInput): Promise<void> {
  const email = sanitizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  const existingByClient = await findWebUserByAccountAndClientId(input.accountId, input.clientId);
  if (existingByClient) {
    return;
  }

  const existingByEmail = await findWebUserByEmailAnyAccount(email);
  if (existingByEmail && existingByEmail.account_id !== input.accountId) {
    return;
  }

  if (existingByEmail) {
    if (existingByEmail.email_verified_at) {
      if (!existingByEmail.client_id) {
        await updateWebUserProfile({ accountId: input.accountId, id: existingByEmail.id, clientId: input.clientId });
      }
      return;
    }

    const inviteToken = createToken();
    const inviteTokenHash = hashPassword(inviteToken, existingByEmail.password_salt);
    await updateWebUserProfile({
      accountId: input.accountId,
      id: existingByEmail.id,
      clientId: input.clientId,
      firstName,
      lastName,
      telegramUsername: input.telegramUsername?.trim() || undefined,
    });
    await updateWebUserAuthState({
      accountId: input.accountId,
      id: existingByEmail.id,
      emailVerificationCode: inviteTokenHash,
      emailVerificationSentAt: new Date(),
    });
    await sendManagedUserInviteEmail({ to: email, firstName, inviteLink: buildInviteLink(email, inviteToken) });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const inviteToken = createToken();
  const inviteTokenHash = hashPassword(inviteToken, salt);
  const passwordHash = hashPassword(createToken(), salt);

  const created = await createWebUser({
    accountId: input.accountId,
    email,
    role: WebUserRole.Client,
    firstName,
    lastName,
    telegramUsername: input.telegramUsername?.trim() || undefined,
    passwordHash,
    passwordSalt: salt,
    timezone: input.timezone?.trim() || undefined,
    emailVerificationCode: inviteTokenHash,
    emailVerificationSentAt: new Date(),
    isActive: false,
  });

  await updateWebUserProfile({ accountId: input.accountId, id: created.id, clientId: input.clientId });
  await sendManagedUserInviteEmail({ to: email, firstName, inviteLink: buildInviteLink(email, inviteToken) });
}
