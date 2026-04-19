import { runAlertChecks } from '../monitoring/alerts';
import { logError } from '../utils/logger';

const DEFAULT_ALERT_INTERVAL_MS = 60_000;

export function startAlertsJob(
  intervalMs = DEFAULT_ALERT_INTERVAL_MS,
  noUpdatesThresholdMs?: number,
  failedGrowthThreshold?: number,
) {
  const timer = setInterval(async () => {
    try {
      await runAlertChecks({ noUpdatesThresholdMs, failedGrowthThreshold });
    } catch (error) {
      logError('alerts.job_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
