import { db } from '../db/knex.js';

export type MicrosoftOAuthStateRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  state_token: string;
  created_at: Date;
  expires_at: Date;
};

export async function createMicrosoftOAuthState(input: {
  accountId: number;
  webUserId: number;
  stateToken: string;
  expiresAt: Date;
}): Promise<void> {
  await db('microsoft_oauth_states').insert({
    account_id: input.accountId,
    web_user_id: input.webUserId,
    state_token: input.stateToken,
    expires_at: input.expiresAt,
  });
}

export async function consumeMicrosoftOAuthState(
  stateToken: string,
): Promise<MicrosoftOAuthStateRecord | null> {
  const row = await db.transaction(async (trx) => {
    const found = await trx('microsoft_oauth_states')
      .where({ state_token: stateToken })
      .first<MicrosoftOAuthStateRecord>();

    if (!found) {
      return null;
    }

    await trx('microsoft_oauth_states')
      .where({ id: found.id })
      .delete();

    return found;
  });

  if (!row || row.expires_at.getTime() < Date.now()) {
    return null;
  }

  return row;
}
