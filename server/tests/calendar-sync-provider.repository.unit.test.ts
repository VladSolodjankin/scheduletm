import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => Object.assign(vi.fn(), { raw: vi.fn(), fn: { now: vi.fn() }, transaction: vi.fn() }));
vi.mock('../src/db/knex.js', () => ({ db: dbMock }));
vi.mock('../src/config/env.js', () => ({ env: { GOOGLE_OAUTH_WRITE_SCOPE: 'https://www.googleapis.com/auth/calendar.events' } }));

const { enqueueGoogleCalendarSync, enqueueGoogleCalendarUpserts } = await import('../src/repositories/googleCalendarSyncRepository.js');

const GOOGLE = 'https://www.googleapis.com/auth/calendar.events';
const MICROSOFT = 'Calendars.ReadWrite User.Read';

function mockGate(row: Record<string, string | null> | undefined) {
  const chain: Record<string, unknown> = {};
  chain.join = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.first = vi.fn().mockResolvedValue(row);
  dbMock.mockReset();
  dbMock.mockReturnValue(chain);
}

const bindings = () => dbMock.raw.mock.calls.map((call) => call[1]);

describe('provider-aware calendar sync queue', () => {
  beforeEach(() => {
    dbMock.raw.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('fans out one coalesced row per connected provider', async () => {
    mockGate({ google_granted_scopes: GOOGLE, microsoft_granted_scopes: MICROSOFT });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(true);
    expect(bindings()).toEqual([
      [1, 2, 'upsert', null, null, 'google', null],
      [1, 2, 'upsert', null, null, 'microsoft', null],
    ]);
    expect(dbMock.raw.mock.calls[0][0]).toContain("ON CONFLICT (appointment_id, provider) WHERE status = 'pending'");
  });

  it('queues only Microsoft for a Microsoft-only specialist, nothing without write scope', async () => {
    mockGate({ google_granted_scopes: null, microsoft_granted_scopes: MICROSOFT });
    await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 });
    expect(bindings()).toEqual([[1, 2, 'upsert', null, null, 'microsoft', null]]);

    dbMock.raw.mockClear();
    mockGate({ google_granted_scopes: null, microsoft_granted_scopes: 'User.Read' });
    expect(await enqueueGoogleCalendarSync({ accountId: 1, appointmentId: 2, action: 'upsert', specialistId: 3 })).toBe(false);
    expect(dbMock.raw.mock.calls.filter((call) => String(call[0]).includes('INSERT'))).toEqual([]);
  });

  it('snapshots each provider event reference on delete without a gate query', async () => {
    mockGate(undefined);
    await enqueueGoogleCalendarSync({
      accountId: 1, appointmentId: 2, action: 'delete', googleEventId: 'g1', webUserId: 9, microsoftEventId: 'm1', microsoftWebUserId: 8,
    });
    expect(dbMock).not.toHaveBeenCalled();
    expect(bindings()).toEqual([
      [1, 2, 'delete', 'g1', 9, 'google', null],
      [1, 2, 'delete', null, 8, 'microsoft', 'm1'],
    ]);
  });

  it('series upserts write one row per appointment and provider after one gate check', async () => {
    mockGate({ google_granted_scopes: GOOGLE, microsoft_granted_scopes: MICROSOFT });
    expect(await enqueueGoogleCalendarUpserts({ accountId: 1, specialistId: 3, appointmentIds: [10, 11] })).toBe(2);
    expect(dbMock).toHaveBeenCalledTimes(1);
    expect(bindings().map((b) => [b[1], b[5]])).toEqual([[10, 'google'], [10, 'microsoft'], [11, 'google'], [11, 'microsoft']]);
  });
});
