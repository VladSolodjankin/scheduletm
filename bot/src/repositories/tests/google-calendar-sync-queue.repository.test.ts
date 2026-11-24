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

  it('writes nothing when the specialist has no Google connection with granted scopes', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(false);
    expect(dbMock.raw).not.toHaveBeenCalled();
  });

  it('inserts with the shared coalescing contract when connected with granted scopes', async () => {
    mockGate({ google_granted_scopes: 'calendar.events' });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    const [sql, bindings] = dbMock.raw.mock.calls[0];
    expect(sql).toContain('google_calendar_sync_queue');
    expect(sql).toContain("ON CONFLICT (appointment_id, provider) WHERE status = 'pending'");
    expect(bindings).toEqual([1, 2, 'upsert', null, null, 'google', null]);
  });

  it('fans out one row per connected provider', async () => {
    mockGate({ google_granted_scopes: 'calendar.events', microsoft_granted_scopes: 'Calendars.ReadWrite' });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    expect(dbMock.raw.mock.calls.map((call) => call[1])).toEqual([
      [1, 2, 'upsert', null, null, 'google', null],
      [1, 2, 'upsert', null, null, 'microsoft', null],
    ]);
  });

  it('writes only a microsoft row for a Microsoft-only specialist', async () => {
    mockGate({ google_granted_scopes: null, microsoft_granted_scopes: 'Calendars.ReadWrite' });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    expect(dbMock.raw.mock.calls.map((call) => call[1])).toEqual([[1, 2, 'upsert', null, null, 'microsoft', null]]);
  });

  it('enqueues a delete per known event reference with the provider snapshot', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({
      accountId: 1, appointmentId: 2, action: 'delete', specialistId: 3,
      googleEventId: 'g1', webUserId: 9, microsoftEventId: 'm1', microsoftWebUserId: 9,
    })).toBe(true);
    expect(dbMock).not.toHaveBeenCalled();
    expect(dbMock.raw.mock.calls.map((call) => call[1])).toEqual([
      [1, 2, 'delete', 'g1', 9, 'google', null],
      [1, 2, 'delete', null, 9, 'microsoft', 'm1'],
    ]);
  });

  it('enqueues a delete for an existing Google event without the opt-in lookup', async () => {
    mockGate(undefined);
    expect(await enqueueGoogleCalendarSync({
      accountId: 1, appointmentId: 2, action: 'delete', specialistId: 3, googleEventId: 'evt', webUserId: 9,
    })).toBe(true);
    expect(dbMock).not.toHaveBeenCalled();
    expect(dbMock.raw.mock.calls[0][1]).toEqual([1, 2, 'delete', 'evt', 9, 'google', null]);
  });

  it('never throws when the outbox write fails', async () => {
    mockGate({ google_granted_scopes: 'calendar.events' });
    dbMock.raw.mockRejectedValue(new Error('relation does not exist'));
    await expect(enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 }))
      .resolves.toBe(false);
  });
});
