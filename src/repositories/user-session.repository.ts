import { db } from '../db/knex';
import { BookingPayload, UserSessionState } from '../types/session';

export async function findSessionByUserId(accountId: number, userId: number) {
  return db('user_sessions').where({ account_id: accountId, user_id: userId }).first();
}

export async function createSession(accountId: number, userId: number) {
  const [session] = await db('user_sessions')
    .insert({
      account_id: accountId,
      user_id: userId,
      state: UserSessionState.IDLE,
      payload_json: JSON.stringify({}),
    })
    .returning('*');

  return session;
}

export async function getOrCreateSession(accountId: number, userId: number) {
  const existing = await findSessionByUserId(accountId, userId);
  if (existing) return existing;
  return createSession(accountId, userId);
}

export async function updateSessionState(
  accountId: number,
  userId: number,
  state: UserSessionState,
  payload?: BookingPayload,
) {
  const updateData: Record<string, unknown> = {
    state,
    updated_at: db.fn.now(),
  };

  if (payload !== undefined) {
    updateData.payload_json = JSON.stringify(payload);
  }

  const [session] = await db('user_sessions')
    .where({ account_id: accountId, user_id: userId })
    .update(updateData, ['*']);

  return session;
}

export async function mergeSessionPayload(
  accountId: number,
  userId: number,
  state: UserSessionState,
  patch: Partial<BookingPayload>,
) {
  const session = await getOrCreateSession(accountId, userId);

  const currentPayload =
    typeof session.payload_json === 'string'
      ? JSON.parse(session.payload_json)
      : session.payload_json || {};

  const nextPayload = {
    ...currentPayload,
    ...patch,
  };

  const [updated] = await db('user_sessions')
    .where({ account_id: accountId, user_id: userId })
    .update(
      {
        state,
        payload_json: JSON.stringify(nextPayload),
        updated_at: db.fn.now(),
      },
      ['*'],
    );

  return updated;
}

export async function getSessionPayload(accountId: number, userId: number): Promise<BookingPayload> {
  const session = await getOrCreateSession(accountId, userId);

  if (!session.payload_json) {
    return {};
  }

  if (typeof session.payload_json === 'string') {
    return JSON.parse(session.payload_json) as BookingPayload;
  }

  return session.payload_json as BookingPayload;
}
