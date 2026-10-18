import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => Object.assign(vi.fn(), { raw: vi.fn() }));

vi.mock('../../db/knex', () => ({ db: dbMock }));
vi.mock('../../utils/logger', () => ({ logWarn: vi.fn(), logInfo: vi.fn(), logError: vi.fn() }));

import { enqueueGoogleCalendarSync } from '../google-calendar-sync-queue.repository';

function mockGate(row: unknown) {
  const chain: Record<string, unknown> = {};
  chain.join = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.whereNotNull = vi.fn(() => chain);
  chain.first = vi.fn().mockResolvedValue(row);
  dbMock.mockReset();
  dbMock.mockReturnValue(chain);
}

describe('bot google calendar outbox', () => {
  beforeEach(() => {
    dbMock.raw.mockReset().mockResolvedValue(undefined);
  });

  it('writes nothing when the specialist did not enable event writing', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(false);
    expect(dbMock.raw).not.toHaveBeenCalled();
  });

  it('inserts with the shared coalescing contract when enabled', async () => {
    mockGate({ web_user_id: 9 });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    const [sql, bindings] = dbMock.raw.mock.calls[0];
    expect(sql).toContain('google_calendar_sync_queue');
    expect(sql).toContain("ON CONFLICT (appointment_id) WHERE status = 'pending'");
    expect(bindings).toEqual([1, 2, 'upsert', null, null]);
  });

  it('enqueues a delete for an existing Google event without the opt-in lookup', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({
      accountId: 1, appointmentId: 2, action: 'delete', specialistId: 3, googleEventId: 'evt', webUserId: 9,
    })).toBe(true);
    expect(dbMock).not.toHaveBeenCalled();
    expect(dbMock.raw.mock.calls[0][1]).toEqual([1, 2, 'delete', 'evt', 9]);
  });

  it('never throws when the outbox write fails', async () => {
    mockGate({ web_user_id: 9 });
    dbMock.raw.mockRejectedValue(new Error('relation does not exist'));
    await expect(enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 }))
      .resolves.toBe(false);
  });
});
