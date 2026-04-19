import { countFailedNotifications } from '../repositories/notification-metrics.repository';
import { logWarn } from '../utils/logger';

let http5xxCount = 0;
let lastIncomingUpdateAt: number | null = null;
let previousFailedNotifications = 0;

export function recordIncomingUpdate(updateId?: number) {
  lastIncomingUpdateAt = Date.now();

  if (updateId !== undefined) {
    return updateId;
  }

  return null;
}

export function recordHttp5xx() {
  http5xxCount += 1;
}

export async function runAlertChecks(options?: {
  noUpdatesThresholdMs?: number;
  failedGrowthThreshold?: number;
}) {
  const noUpdatesThresholdMs = options?.noUpdatesThresholdMs ?? 15 * 60 * 1000;
  const failedGrowthThreshold = options?.failedGrowthThreshold ?? 5;

  if (http5xxCount > 0) {
    logWarn('alerts.http_5xx_detected', { count: http5xxCount, alert: true });
    http5xxCount = 0;
  }

  const failedNow = await countFailedNotifications();
  const failedGrowth = failedNow - previousFailedNotifications;
  if (failedGrowth >= failedGrowthThreshold) {
    logWarn('alerts.notifications_failed_growth', {
      previous: previousFailedNotifications,
      current: failedNow,
      growth: failedGrowth,
      threshold: failedGrowthThreshold,
      alert: true,
    });
  }
  previousFailedNotifications = failedNow;

  const now = Date.now();
  if (!lastIncomingUpdateAt || now - lastIncomingUpdateAt > noUpdatesThresholdMs) {
    logWarn('alerts.no_incoming_updates', {
      lastIncomingUpdateAt,
      thresholdMs: noUpdatesThresholdMs,
      alert: true,
    });
  }
}
