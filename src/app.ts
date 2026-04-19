import express from 'express';
import { env } from './config/env';
import { telegramWebhookRouter } from './routes/telegramWebhook';
import { getWebhookInfo, setWebhook } from './bot/bot';
import { startReminderJob } from './jobs/reminder.job';

async function bootstrap() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(telegramWebhookRouter);

  const stopReminderJob = startReminderJob(env.notificationPollMs);

  const server = app.listen(env.port, async () => {
    console.log(`Server started on port ${env.port}`);

    try {
      const result = await setWebhook();
      console.log('Webhook set:', result);

      const info = await getWebhookInfo();
      console.log('Webhook info:', info);
    } catch (error) {
      console.error('Failed to set webhook:', error);
    }
  });

  const shutdown = () => {
    stopReminderJob();
    server.close(() => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('Fatal bootstrap error:', error);
  process.exit(1);
});
