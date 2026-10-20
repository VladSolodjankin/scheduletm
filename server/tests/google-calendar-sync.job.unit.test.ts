import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  claimDueGoogleCalendarSyncItems: vi.fn(),
  markGoogleCalendarSyncDone: vi.fn(),
  markGoogleCalendarSyncRetry: vi.fn(),
  markGoogleCalendarSyncFailed: vi.fn(),
  purgeFinishedGoogleCalendarSyncItems: vi.fn(),
  setGoogleCalendarSyncKickHandler: vi.fn(),
}));
const eventService = vi.hoisted(() => ({
  processGoogleCalendarSyncItem: vi.fn(),
  computeGoogleSyncBackoffMs: vi.fn(() => 60_000),
  GOOGLE_SYNC_MAX_ATTEMPTS: 5,
}));

vi.mock('../src/repositories/googleCalendarSyncRepository.js', () => repo);
vi.mock('../src/services/googleCalendarEventService.js', () => eventService);
vi.mock('../src/services/errorTrackingService.js', () => ({ trackServerError: vi.fn() }));

const { runGoogleCalendarSyncJob, kickGoogleCalendarSync, startGoogleCalendarSyncJob } = await import('../src/jobs/googleCalendarSync.job.js');

const LEASE = new Date('2026-11-01T10:00:00.000Z');
const row = (id: number, attempts = 0) => ({ id, account_id: 1, appointment_id: id + 100, action: 'upsert', attempts, locked_until: LEASE });

describe('googleCalendarSync job', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    eventService.computeGoogleSyncBackoffMs.mockReturnValue(60_000);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  const allOutput = () => [console.log, console.warn, console.error]
    .flatMap((fn) => vi.mocked(fn).mock.calls.map((call) => call.join(' ')))
    .join(' | ');

  it('logs one line per processed row and never any content', async () => {
    repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([row(1), row(2), row(3, 4), row(4)]);
    eventService.processGoogleCalendarSyncItem
      .mockResolvedValueOnce({ kind: 'done', detail: 'synced', event: 'created' })
      .mockResolvedValueOnce({ kind: 'done', detail: 'skipped', reason: 'write_scope_missing' })
      .mockResolvedValueOnce({ kind: 'error', errorStatus: '503', retryable: true })
      .mockResolvedValueOnce({ kind: 'error', errorStatus: '503', retryable: true });

    await runGoogleCalendarSyncJob(0);

    expect(console.log).toHaveBeenCalledWith('[googleCalendarSync] done appointment=101 action=upsert event=created account=1');
    expect(console.log).toHaveBeenCalledWith('[googleCalendarSync] skipped appointment=102 action=upsert reason=write_scope_missing account=1');
    expect(console.error).toHaveBeenCalledWith('[googleCalendarSync] failed appointment=103 action=upsert status=503 attempt=5 account=1');
    expect(console.warn).toHaveBeenCalledWith('[googleCalendarSync] retry appointment=104 action=upsert status=503 attempt=1 account=1');
    const output = allOutput();
    for (const secret of ['Haircut', 'client@example.com', 'ya29.token', 'Ivan Petrov']) {
      expect(output).not.toContain(secret);
    }
  });

  it('logs the startup line with the interval', () => {
    vi.useFakeTimers();
    try {
      const timer = startGoogleCalendarSyncJob(1234);
      expect(console.log).toHaveBeenCalledWith('[googleCalendarSync] job started intervalMs=1234');
      clearInterval(timer);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks successful rows done and processes rows sequentially', async () => {
    repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([row(1), row(2)]);
    eventService.processGoogleCalendarSyncItem.mockResolvedValue({ kind: 'done', detail: 'synced', event: 'created' });

    expect(await runGoogleCalendarSyncJob(0)).toBe(2);
    expect(repo.markGoogleCalendarSyncDone.mock.calls).toEqual([[1, LEASE], [2, LEASE]]);
  });

  it('reschedules retryable errors with backoff and fails after the attempt cap', async () => {
    repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([row(1, 0), row(2, 4), row(3, 0)]);
    eventService.processGoogleCalendarSyncItem
      .mockResolvedValueOnce({ kind: 'error', errorStatus: '503', retryable: true })
      .mockResolvedValueOnce({ kind: 'error', errorStatus: '503', retryable: true })
      .mockResolvedValueOnce({ kind: 'error', errorStatus: '400', retryable: false });

    await runGoogleCalendarSyncJob(0);

    expect(repo.markGoogleCalendarSyncRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 1, attempts: 1, errorStatus: '503' }));
    expect(repo.markGoogleCalendarSyncFailed).toHaveBeenCalledWith({ id: 2, attempts: 5, errorStatus: '503', lockedUntil: LEASE });
    expect(repo.markGoogleCalendarSyncFailed).toHaveBeenCalledWith({ id: 3, attempts: 1, errorStatus: '400', lockedUntil: LEASE });
  });

  it('purges old finished rows when idle', async () => {
    repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([]);
    expect(await runGoogleCalendarSyncJob(0)).toBe(0);
    expect(repo.purgeFinishedGoogleCalendarSyncItems).toHaveBeenCalledOnce();
  });

  it('logs nothing on an idle pass', async () => {
    repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([]);
    await runGoogleCalendarSyncJob(0);
    expect(allOutput()).toBe('');
  });

  it('serializes kicks: a kick during a pass causes exactly one follow-up pass', async () => {
    let release: (items: unknown[]) => void = () => undefined;
    repo.claimDueGoogleCalendarSyncItems.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([]);

    kickGoogleCalendarSync();
    kickGoogleCalendarSync();
    kickGoogleCalendarSync();
    expect(repo.claimDueGoogleCalendarSyncItems).toHaveBeenCalledTimes(1);

    release([]);
    await vi.waitFor(() => expect(repo.claimDueGoogleCalendarSyncItems).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    expect(repo.claimDueGoogleCalendarSyncItems).toHaveBeenCalledTimes(2);
  });

  it('kick never throws when a pass fails', async () => {
    repo.claimDueGoogleCalendarSyncItems.mockRejectedValue(new Error('db down'));
    expect(() => kickGoogleCalendarSync()).not.toThrow();
    await vi.waitFor(() => expect(repo.claimDueGoogleCalendarSyncItems).toHaveBeenCalled());
  });

  it('registers the kick handler and polls every 10 seconds', () => {
    vi.useFakeTimers();
    try {
      repo.claimDueGoogleCalendarSyncItems.mockResolvedValue([]);
      const timer = startGoogleCalendarSyncJob();
      expect(repo.setGoogleCalendarSyncKickHandler).toHaveBeenCalledWith(kickGoogleCalendarSync);
      vi.advanceTimersByTime(9_999);
      expect(repo.claimDueGoogleCalendarSyncItems).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(repo.claimDueGoogleCalendarSyncItems).toHaveBeenCalledTimes(1);
      clearInterval(timer);
    } finally {
      vi.useRealTimers();
    }
  });
});
