import { deleteExpiredSessions } from '../repositories/user-session.repository';
import { logError, logInfo } from '../utils/logger';

export function startUserSessionCleanupJob(retentionMs: number, intervalMs: number) {
  let running = false;
  let stopped = false;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const deletedCount = await deleteExpiredSessions(new Date(Date.now() - retentionMs));
      logInfo('user_session.cleanup_completed', { deleted_count: deletedCount });
    } catch (error) {
      logError('user_session.cleanup_failed', { error });
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
