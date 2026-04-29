import express from 'express';
import { env } from './config/env';
import { telegramWebhookRouter } from './routes/telegramWebhook';
import { getWebhookInfo, setWebhook } from './bot/bot';
import { startReminderJob } from './jobs/reminder.job';
import { startAlertsJob } from './jobs/alerts.job';
import { logError, logInfo } from './utils/logger';
import { trackBotError } from './services/errorTracking.service';

async function bootstrap() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(telegramWebhookRouter);

  app.use((error: unknown, _req: express.Request, _res: express.Response, _next: express.NextFunction) => {
    void trackBotError({
      method: 'WEBHOOK',
      path: '/telegram/webhook',
      error,
    });
  });

  const stopReminderJob = startReminderJob(env.notificationPollMs);
  const stopAlertsJob = startAlertsJob(
    env.alertPollMs,
    env.alertNoUpdatesThresholdMs,
    env.alertFailedGrowthThreshold,
  );

  const server = app.listen(env.port, async () => {
    logInfo('app.started', { port: env.port, node_env: env.nodeEnv });

    if (env.isProduction && env.autoSetWebhook) {
      try {
        const result = await setWebhook();
        logInfo('telegram.webhook_set', { result });

        const info = await getWebhookInfo();
        logInfo('telegram.webhook_info', { info });
      } catch (error) {
        logError('telegram.webhook_set_failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    logInfo('telegram.webhook_autoset_skipped', {
      reason: 'AUTO_SET_WEBHOOK is enabled only in production',
      node_env: env.nodeEnv,
      auto_set_webhook: env.autoSetWebhook,
    });
  });

  const shutdown = () => {
    stopReminderJob();
    stopAlertsJob();
    server.close(() => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  void trackBotError({
    method: 'PROCESS',
    path: '/process/unhandled-rejection',
    error: reason,
  });
});

process.on('uncaughtException', (error) => {
  void trackBotError({
    method: 'PROCESS',
    path: '/process/uncaught-exception',
    error,
  });
});

bootstrap().catch((error) => {
  void trackBotError({
    method: 'PROCESS',
    path: '/process/bootstrap',
    error,
  });
  logError('app.bootstrap_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
