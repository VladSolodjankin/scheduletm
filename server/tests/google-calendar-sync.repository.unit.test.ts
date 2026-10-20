import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => Object.assign(vi.fn(), { raw: vi.fn(), fn: { now: vi.fn() }, transaction: vi.fn() }));
vi.mock('../src/db/knex.js', () => ({ db: dbMock }));
vi.mock('../src/config/env.js', () => ({ env: { GOOGLE_OAUTH_WRITE_SCOPE: 'https://www.googleapis.com/auth/calendar.events' } }));

const {
  enqueueGoogleCalendarSync,
  enqueueGoogleCalendarUpserts,
  markGoogleCalendarSyncDone,
  markGoogleCalendarSyncFailed,
  markGoogleCalendarSyncRetry,
  setGoogleCalendarSyncKickHandler,
} = await import(
  '../src/repositories/googleCalendarSyncRepository.js'
);

const WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function mockGate(row: { google_granted_scopes: string | null } | undefined) {
  const chain: Record<string, unknown> = {};
  chain.join = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.whereNotNull = vi.fn(() => chain);
  chain.first = vi.fn().mockResolvedValue(row);
  dbMock.mockReset();
  dbMock.mockReturnValue(chain);
}

function mockGateDenied(diagnostic: unknown) {
  const chain: Record<string, unknown> = {};
  chain.join = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.whereNotNull = vi.fn(() => chain);
  chain.first = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(diagnostic);
  dbMock.mockReset();
  dbMock.mockReturnValue(chain);
}

describe('google calendar sync outbox', () => {
  beforeEach(() => {
    dbMock.raw.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it.each([
    [undefined, 'no_specialist'],
    [{ user_id: null, web_user_id: null, has_token: false }, 'specialist_has_no_web_user'],
    [{ user_id: 8, web_user_id: null, has_token: false }, 'no_integration_row'],
    [{ user_id: 8, web_user_id: 8, has_token: false }, 'no_access_token'],
    [{ user_id: 8, web_user_id: 8, has_token: true }, 'write_scope_missing'],
  ])('logs the precise skip reason for %j', async (diagnostic, reason) => {
    mockGateDenied(diagnostic);
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(false);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      `[googleCalendarSync] not queued appointment=2 account=1 action=upsert skip=${reason}`,
    );
  });

  it('logs no_specialist_id without any query and logs queued on success', async () => {
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert' })).toBe(false);
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining('skip=no_specialist_id'));

    mockGate({ google_granted_scopes: WRITE_SCOPE });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    expect(console.log).toHaveBeenLastCalledWith('[googleCalendarSync] queued appointment=2 action=upsert');
  });

  it('logs the series skip reason', async () => {
    mockGateDenied({ user_id: 8, web_user_id: 8, has_token: true });
    expect(await enqueueGoogleCalendarUpserts({ accountId: 1, specialistId: 3, appointmentIds: [10, 11] })).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      '[googleCalendarSync] not queued appointments=10,11 account=1 action=upsert skip=write_scope_missing',
    );
  });

  it('writes no row when the specialist did not opt in', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(false);
    expect(dbMock.raw).not.toHaveBeenCalled();
  });

  it('writes no row when the write scope was not granted', async () => {
    mockGate({ google_granted_scopes: 'https://www.googleapis.com/auth/calendar.freebusy' });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(false);
    expect(dbMock.raw).not.toHaveBeenCalled();
  });

  it('coalesces through a single ON CONFLICT upsert on the pending row', async () => {
    mockGate({ google_granted_scopes: WRITE_SCOPE });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    const [sql, bindings] = dbMock.raw.mock.calls[0];
    expect(sql).toContain("ON CONFLICT (appointment_id) WHERE status = 'pending'");
    expect(sql).toContain("THEN 'delete'");
    expect(bindings).toEqual([1, 2, 'upsert', null, null]);
  });

  it('enqueues a delete for a known Google event without the opt-in lookup', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({
      accountId: 1, appointmentId: 2, action: 'delete', googleEventId: 'evt', webUserId: 9,
    })).toBe(true);
    expect(dbMock).not.toHaveBeenCalled();
    expect(dbMock.raw.mock.calls[0][1]).toEqual([1, 2, 'delete', 'evt', 9]);
  });

  it('never throws when the queue write fails', async () => {
    mockGate({ google_granted_scopes: WRITE_SCOPE });
    dbMock.raw.mockRejectedValue(new Error('relation missing'));
    await expect(enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 }))
      .resolves.toBe(false);
  });

  it('enqueues one upsert per series row after a single opt-in check, inside a savepoint', async () => {
    mockGate({ google_granted_scopes: WRITE_SCOPE });
    const savepoint = Object.assign(dbMock, {});
    const trx = Object.assign(vi.fn(), {
      isTransaction: true,
      transaction: vi.fn(async (callback: (sp: unknown) => unknown) => callback(savepoint)),
    });

    const count = await enqueueGoogleCalendarUpserts(
      { accountId: 1, specialistId: 3, appointmentIds: [10, 11, 12] },
      trx as never,
    );

    expect(count).toBe(3);
    expect(trx.transaction).toHaveBeenCalledOnce();
    expect(dbMock.raw).toHaveBeenCalledTimes(3);
    expect(dbMock).toHaveBeenCalledTimes(1);
  });

  describe('stale worker protection', () => {
    function mockUpdateChain() {
      const chain: Record<string, unknown> = {};
      chain.where = vi.fn(() => chain);
      chain.whereRaw = vi.fn(() => chain);
      chain.update = vi.fn().mockResolvedValue(1);
      dbMock.mockReset();
      dbMock.mockReturnValue(chain);
      dbMock.fn = { now: vi.fn() };
      return chain as { where: ReturnType<typeof vi.fn>; whereRaw: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    }
    const lease = new Date('2026-11-01T10:00:00.000Z');

    it('markDone only touches a processing row that still has the claimed lease', async () => {
      const chain = mockUpdateChain();
      await markGoogleCalendarSyncDone(7, lease);
      expect(chain.where).toHaveBeenCalledWith({ id: 7, status: 'processing' });
      expect(chain.whereRaw).toHaveBeenCalledWith(expect.stringContaining('locked_until'), [lease]);
    });

    it('markRetry and markFailed are conditional on processing status and lease', async () => {
      const retry = mockUpdateChain();
      await markGoogleCalendarSyncRetry({ id: 7, attempts: 1, nextAttemptAt: new Date(), errorStatus: '503', lockedUntil: lease });
      expect(retry.where).toHaveBeenCalledWith({ id: 7, status: 'processing' });
      expect(retry.whereRaw).toHaveBeenCalledWith(expect.stringContaining('locked_until'), [lease]);

      const failed = mockUpdateChain();
      await markGoogleCalendarSyncFailed({ id: 7, attempts: 5, errorStatus: '503', lockedUntil: lease });
      expect(failed.where).toHaveBeenCalledWith({ id: 7, status: 'processing' });
      expect(failed.whereRaw).toHaveBeenCalledWith(expect.stringContaining('locked_until'), [lease]);
    });

    it('still requires processing status when no lease is supplied', async () => {
      const chain = mockUpdateChain();
      await markGoogleCalendarSyncDone(7);
      expect(chain.where).toHaveBeenCalledWith({ id: 7, status: 'processing' });
      expect(chain.whereRaw).not.toHaveBeenCalled();
    });
  });

  describe('kick after enqueue', () => {
    const kick = vi.fn();
    beforeEach(() => {
      vi.useFakeTimers();
      kick.mockReset();
      setGoogleCalendarSyncKickHandler(kick);
    });
    afterEach(() => {
      setGoogleCalendarSyncKickHandler(null);
      vi.useRealTimers();
    });

    it('kicks after a delay, not synchronously, once a row is enqueued', async () => {
      mockGate({ google_granted_scopes: WRITE_SCOPE });
      await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 });
      expect(kick).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1_000);
      expect(kick).toHaveBeenCalledTimes(1);
    });

    it('kicks after a batch enqueue', async () => {
      mockGate({ google_granted_scopes: WRITE_SCOPE });
      await enqueueGoogleCalendarUpserts({ accountId: 1, specialistId: 3, appointmentIds: [5, 6] });
      vi.advanceTimersByTime(1_000);
      expect(kick).toHaveBeenCalledTimes(1);
    });

    it('does not kick when the gate skips the enqueue or the write fails', async () => {
      mockGate({ google_granted_scopes: null });
      await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 });
      mockGate({ google_granted_scopes: WRITE_SCOPE });
      dbMock.raw.mockRejectedValue(new Error('boom'));
      await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 });
      vi.advanceTimersByTime(5_000);
      expect(kick).not.toHaveBeenCalled();
    });

    it('never propagates a kick failure', async () => {
      mockGate({ google_granted_scopes: WRITE_SCOPE });
      kick.mockImplementation(() => { throw new Error('x'); });
      await expect(enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 }))
        .resolves.toBe(true);
      expect(() => vi.advanceTimersByTime(1_000)).not.toThrow();
    });
  });
});
