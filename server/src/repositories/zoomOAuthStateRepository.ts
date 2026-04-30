import { db } from '../db/knex.js';

export type ZoomOAuthStateRecord = {
  id: number;
  account_id: number;
  web_user_id: number;
  state_token: string;
  created_at: Date;
  expires_at: Date;
};

export async function createZoomOAuthState(input: {
  accountId: number;
  webUserId: number;
  stateToken: string;
  expiresAt: Date;
}): Promise<void> {
  await db('zoom_oauth_states').insert({
    account_id: input.accountId,
    web_user_id: input.webUserId,
    state_token: input.stateToken,
    expires_at: input.expiresAt,
  });
}

export async function consumeZoomOAuthState(
  accountId: number,
  stateToken: string,
): Promise<ZoomOAuthStateRecord | null> {
  const row = await db.transaction(async (trx) => {
    const found = await trx('zoom_oauth_states')
      .where({ account_id: accountId, state_token: stateToken })
      .first<ZoomOAuthStateRecord>();

    if (!found) {
      return null;
    }

    await trx('zoom_oauth_states')
      .where({ id: found.id })
      .delete();

    return found;
  });

  if (!row || row.expires_at.getTime() < Date.now()) {
    return null;
  }

  return row;
}
