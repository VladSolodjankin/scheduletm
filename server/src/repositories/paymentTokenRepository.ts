import crypto from 'node:crypto';
import { db } from '../db/knex.js';

export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export async function createAppointmentPaymentToken(appointmentId: number, expiresAt: Date): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db('appointment_payment_tokens').insert({
    appointment_id: appointmentId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  return token;
}

export async function findAppointmentPaymentToken(
  token: string,
): Promise<{ appointment_id: number; expires_at: Date } | null> {
  return (await db('appointment_payment_tokens')
    .where({ token_hash: hashToken(token) })
    .first<{ appointment_id: number; expires_at: Date }>('appointment_id', 'expires_at')) ?? null;
}

export async function createStripeOAuthState(input: {
  accountId: number;
  webUserId: number;
  stateToken: string;
  expiresAt: Date;
}): Promise<void> {
  await db('stripe_oauth_states').insert({
    account_id: input.accountId,
    web_user_id: input.webUserId,
    state_token: input.stateToken,
    expires_at: input.expiresAt,
  });
}

/** Single use: the row is deleted on read, expired states are rejected. */
export async function consumeStripeOAuthState(
  stateToken: string,
): Promise<{ account_id: number; web_user_id: number } | null> {
  const rows = await db('stripe_oauth_states')
    .where({ state_token: stateToken })
    .delete()
    .returning<Array<{ account_id: number; web_user_id: number; expires_at: Date }>>(['account_id', 'web_user_id', 'expires_at']);
  const found = rows[0];
  if (!found || found.expires_at.getTime() < Date.now()) {
    return null;
  }
  return { account_id: found.account_id, web_user_id: found.web_user_id };
}
