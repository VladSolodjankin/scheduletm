import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserSessionState } from '../../types/session';

type SessionRow = {
  id?: number;
  user_id: number;
  state: string;
  payload_json?: any;
  updated_at?: any;
};

function createDbMock(initialSession: SessionRow | null) {
  const state: { session: SessionRow | null } = { session: initialSession };

  const qb: any = {
    where: vi.fn().mockReturnThis(),
    first: vi.fn(async () => state.session),
    insert: vi.fn((row: any) => {
      state.session = {
        id: 1,
        user_id: row.user_id,
        state: row.state,
        payload_json: row.payload_json,
      };
      return qb;
    }),
    returning: vi.fn(async () => (state.session ? [state.session] : [])),
    update: vi.fn(async (patch: any) => {
      if (!state.session) return [];
      state.session = { ...state.session, ...patch };
      return [state.session];
    }),
  };

  const db: any = ((table: string) => {
    expect(table).toBe('telegram_user_sessions');
    return qb;
  }) as any;

  db.fn = {
    now: () => '__NOW__',
  };

  return { db, qb, state };
}

vi.mock('../../db/knex', () => {
  // Each test sets globalThis.__dbMock to a knex-like function with db.fn.now().
  const dbProxy: any = (...args: any[]) => (globalThis as any).__dbMock(...args);

  Object.defineProperty(dbProxy, 'fn', {
    get() {
      return (globalThis as any).__dbMock?.fn;
    },
  });

  return { db: dbProxy };
});

import {
  createSession,
  getOrCreateSession,
  getSessionPayload,
  mergeSessionPayload,
  updateSessionState,
} from '../user-session.repository';

describe('user-session.repository', () => {
  afterEach(() => {
    vi.resetAllMocks();
    delete (globalThis as any).__dbMock;
  });

  it('getOrCreateSession returns existing session', async () => {
    const { db, qb, state } = createDbMock({
      id: 1,
      user_id: 10,
      state: 'idle',
      payload_json: '{}',
    });
    (globalThis as any).__dbMock = db;

    const session = await getOrCreateSession(7, 10);

    expect(session).toEqual(state.session);
    expect(qb.insert).not.toHaveBeenCalled();
  });

  it('createSession inserts default state and empty payload', async () => {
    const { db, qb } = createDbMock(null);
    (globalThis as any).__dbMock = db;

    const session = await createSession(7, 10);

    expect(qb.insert).toHaveBeenCalledWith({
      account_id: 7,
      user_id: 10,
      state: UserSessionState.IDLE,
      payload_json: JSON.stringify({}),
    });
    expect(session.user_id).toBe(10);
    expect(session.state).toBe(UserSessionState.IDLE);
  });

  it('updateSessionState does not overwrite payload when payload is omitted', async () => {
    const { db, qb, state } = createDbMock({
      id: 1,
      user_id: 10,
      state: UserSessionState.IDLE,
      payload_json: JSON.stringify({ a: 1 }),
    });
    (globalThis as any).__dbMock = db;

    const out = await updateSessionState(7, 10, UserSessionState.CHOOSING_SERVICE);

    const patch = vi.mocked(qb.update).mock.calls[0]?.[0] as any;
    expect(patch.state).toBe(UserSessionState.CHOOSING_SERVICE);
    expect(patch.updated_at).toBe('__NOW__');
    expect(patch.payload_json).toBeUndefined();
    expect(out).toEqual(state.session);
    expect(state.session?.payload_json).toBe(JSON.stringify({ a: 1 }));
  });

  it('mergeSessionPayload merges patch into existing JSON string payload', async () => {
    const { db, qb, state } = createDbMock({
      id: 1,
      user_id: 10,
      state: UserSessionState.IDLE,
      payload_json: JSON.stringify({ serviceId: 1, enteredEmail: 'x@y.z' }),
    });
    (globalThis as any).__dbMock = db;

    await mergeSessionPayload(7, 10, UserSessionState.CHOOSING_TIME, {
      selectedDate: '2026-04-18',
    });

    const patch = vi.mocked(qb.update).mock.calls[0]?.[0] as any;
    expect(patch.state).toBe(UserSessionState.CHOOSING_TIME);
    expect(patch.updated_at).toBe('__NOW__');
    expect(JSON.parse(patch.payload_json)).toEqual({
      serviceId: 1,
      enteredEmail: 'x@y.z',
      selectedDate: '2026-04-18',
    });

    expect(JSON.parse(String(state.session?.payload_json))).toEqual({
      serviceId: 1,
      enteredEmail: 'x@y.z',
      selectedDate: '2026-04-18',
    });
  });

  it('mergeSessionPayload merges patch into existing object payload', async () => {
    const { db, qb } = createDbMock({
      id: 1,
      user_id: 10,
      state: UserSessionState.IDLE,
      payload_json: { serviceId: 1, selectedDate: '2026-04-18' },
    });
    (globalThis as any).__dbMock = db;

    await mergeSessionPayload(7, 10, UserSessionState.CHOOSING_TIME, {
      selectedTime: '09:00',
    });

    const patch = vi.mocked(qb.update).mock.calls[0]?.[0] as any;
    expect(JSON.parse(patch.payload_json)).toEqual({
      serviceId: 1,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
    });
  });

  it('getSessionPayload returns {} for null/empty payload_json', async () => {
    const { db } = createDbMock({
      id: 1,
      user_id: 10,
      state: UserSessionState.IDLE,
      payload_json: null,
    });
    (globalThis as any).__dbMock = db;

    const out = await getSessionPayload(7, 10);
    expect(out).toEqual({});
  });
});
