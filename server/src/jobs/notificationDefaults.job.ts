import { listAccountIdsWithoutNotificationDefaults } from '../repositories/accountNotificationDefaultsRepository.js';
import { buildDefaultAccountNotificationSettings, getAccountNotificationDefaults } from '../services/notificationSettingsService.js';
import { trackServerError } from '../services/errorTrackingService.js';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export function startNotificationDefaultsJob(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  return setInterval(() => {
    void runNotificationDefaultsJob().catch((error) => {
      void trackServerError({
        method: 'JOB',
        path: '/jobs/notification-defaults',
        error,
      });
    });
  }, intervalMs);
}

export async function runNotificationDefaultsJob(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  const accountIds = await listAccountIdsWithoutNotificationDefaults(batchSize);
  if (accountIds.length === 0) {
    return 0;
  }

  const defaults = buildDefaultAccountNotificationSettings();
  await Promise.all(accountIds.map(async (accountId) => {
    await getAccountNotificationDefaults(accountId);
  }));

  return defaults.length * accountIds.length;
}
