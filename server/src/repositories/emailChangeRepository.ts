import { db } from '../db/knex.js';
import { verifyPassword } from '../utils/crypto.js';

const RESEND_COOLDOWN_MS = 60_000;
const SEND_WINDOW_MS = 60 * 60_000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_FAILED_ATTEMPTS = 5;

type Challenge = {
  id: number;
  new_email: string;
  code_hash: string;
  code_salt: string;
  expires_at: Date;
  failed_attempts: number;
  created_at: Date;
};

export async function createEmailChangeChallenge(input: {
  accountId: number; webUserId: number; newEmail: string; codeHash: string; codeSalt: string; expiresAt: Date; now: Date;
}): Promise<boolean> {
  return db.transaction(async (trx) => {
    const user = await trx('web_users').where({ id: input.webUserId, account_id: input.accountId })
      .forUpdate().first<{ id: number }>();
    if (!user) return false;

    const latest = await trx('email_change_challenges').where({ web_user_id: input.webUserId })
      .orderBy('created_at', 'desc').first<Pick<Challenge, 'created_at'>>();
    if (latest && input.now.getTime() - latest.created_at.getTime() < RESEND_COOLDOWN_MS) return false;

    const countRow = await trx('email_change_challenges').where({ web_user_id: input.webUserId })
      .andWhere('created_at', '>=', new Date(input.now.getTime() - SEND_WINDOW_MS))
      .count<{ count: string }[]>({ count: '*' }).first();
    if (Number(countRow?.count ?? 0) >= MAX_SENDS_PER_WINDOW) return false;

    await trx('email_change_challenges').where({ web_user_id: input.webUserId }).whereNull('consumed_at')
      .update({ consumed_at: input.now, updated_at: input.now });
    await trx('email_change_challenges').insert({
      account_id: input.accountId, web_user_id: input.webUserId, new_email: input.newEmail,
      code_hash: input.codeHash, code_salt: input.codeSalt, expires_at: input.expiresAt,
      created_at: input.now, updated_at: input.now,
    });
    return true;
  });
}

export async function confirmEmailChange(input: {
  accountId: number; webUserId: number; code: string; now: Date;
}): Promise<boolean> {
  return db.transaction(async (trx) => {
    const challenge = await trx('email_change_challenges')
      .where({ account_id: input.accountId, web_user_id: input.webUserId }).whereNull('consumed_at')
      .orderBy('created_at', 'desc').forUpdate().first<Challenge>();
    if (!challenge || challenge.expires_at.getTime() <= input.now.getTime()
      || challenge.failed_attempts >= MAX_FAILED_ATTEMPTS) return false;

    if (!verifyPassword(input.code, challenge.code_salt, challenge.code_hash)) {
      const failedAttempts = challenge.failed_attempts + 1;
      await trx('email_change_challenges').where({ id: challenge.id }).whereNull('consumed_at').update({
        failed_attempts: failedAttempts,
        consumed_at: failedAttempts >= MAX_FAILED_ATTEMPTS ? input.now : null,
        updated_at: input.now,
      });
      return false;
    }

    const emailTaken = await trx('web_users')
      .whereRaw('LOWER(email) = LOWER(?)', [challenge.new_email])
      .andWhereNot({ id: input.webUserId })
      .first('id');
    if (emailTaken) return false;

    const consumed = await trx('email_change_challenges')
      .where({ id: challenge.id, failed_attempts: challenge.failed_attempts }).whereNull('consumed_at')
      .andWhere('expires_at', '>', input.now).update({ consumed_at: input.now, updated_at: input.now });
    if (consumed !== 1) return false;

    await trx('web_users').where({ id: input.webUserId, account_id: input.accountId }).update({
      email: challenge.new_email, email_verified_at: input.now, updated_at: input.now,
    });
    await trx('web_user_sessions').where({ web_user_id: input.webUserId, account_id: input.accountId })
      .whereNull('revoked_at').update({ revoked_at: input.now, updated_at: input.now });
    return true;
  });
}
