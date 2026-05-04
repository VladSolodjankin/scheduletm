import { trackServerError } from '../services/errorTrackingService.js';
import { purgeDueDeletions } from '../services/deletionService.js';

const INTERVAL_MS = 60_000;

export function startDeletionCleanupJob(): NodeJS.Timeout {
  void purgeDueDeletions().catch((error) => {
    console.error('[jobs] deletion-cleanup initial run failed', error);
    void trackServerError({
      method: 'JOB',
      path: '/jobs/deletion-cleanup',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });

  return setInterval(() => {
    void purgeDueDeletions().catch((error) => {
      console.error('[jobs] deletion-cleanup failed', error);
      void trackServerError({
        method: 'JOB',
        path: '/jobs/deletion-cleanup',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  }, INTERVAL_MS);
}
