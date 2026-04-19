import { processDueNotifications } from '../services/notification.service';
import { logError, logInfo } from '../utils/logger';

const DEFAULT_INTERVAL_MS = 60_000;

export function startReminderJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const timer = setInterval(async () => {
    try {
      const processed = await processDueNotifications();
      if (processed > 0) {
        logInfo('reminder.job_processed', { processed });
      }
    } catch (error) {
      logError('reminder.job_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
