import { afterEach, describe, expect, it, vi } from 'vitest';

const { deleteExpiredSessions } = vi.hoisted(() => ({
  deleteExpiredSessions: vi.fn(),
}));
vi.mock('../../repositories/user-session.repository', () => ({ deleteExpiredSessions }));
vi.mock('../../utils/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { startUserSessionCleanupJob } from '../user-session-cleanup.job';
import { logError, logInfo } from '../../utils/logger';

describe('user session cleanup job', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('runs on startup and interval and logs only the deleted count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00.000Z'));
    deleteExpiredSessions.mockResolvedValue(3);

    const stop = startUserSessionCleanupJob(1_000, 5_000);
    await vi.runAllTicks();

    expect(deleteExpiredSessions).toHaveBeenCalledWith(new Date('2026-08-04T11:59:59.000Z'));
    expect(logInfo).toHaveBeenCalledWith('user_session.cleanup_completed', { deleted_count: 3 });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(2);
    stop();
  });

  it('guards against overlapping runs and stops future intervals', async () => {
    vi.useFakeTimers();
    let resolveCleanup!: (value: number) => void;
    deleteExpiredSessions.mockImplementation(() => new Promise<number>((resolve) => {
      resolveCleanup = resolve;
    }));

    const stop = startUserSessionCleanupJob(1_000, 5_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);

    stop();
    resolveCleanup(0);
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);
  });

  it('sanitizes failures through the logger', async () => {
    vi.useFakeTimers();
    const error = new Error('db failed');
    deleteExpiredSessions.mockRejectedValue(error);
    const stop = startUserSessionCleanupJob(1_000, 5_000);
    await vi.runAllTicks();
    expect(logError).toHaveBeenCalledWith('user_session.cleanup_failed', { error });
    stop();
  });
});
