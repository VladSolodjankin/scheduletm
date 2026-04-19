import { processDueNotifications } from '../services/notification.service';

const DEFAULT_INTERVAL_MS = 60_000;

export function startReminderJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const timer = setInterval(async () => {
    try {
      const processed = await processDueNotifications();
      if (processed > 0) {
        console.log(`[reminder.job] processed notifications: ${processed}`);
      }
    } catch (error) {
      console.error('[reminder.job] failed to process notifications', error);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
