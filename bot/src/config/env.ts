import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT || 3000),
  botToken: getEnv("BOT_TOKEN"),
  webhookSecret: getEnv("WEBHOOK_SECRET"),
  appUrl: getEnv("APP_URL"),
  autoSetWebhook: process.env.AUTO_SET_WEBHOOK === '1' || process.env.AUTO_SET_WEBHOOK === 'true',
  notificationPollMs: Number(process.env.NOTIFICATION_POLL_MS || 60000),
  alertPollMs: Number(process.env.ALERT_POLL_MS || 60000),
  alertNoUpdatesThresholdMs: Number(process.env.ALERT_NO_UPDATES_THRESHOLD_MS || 15 * 60 * 1000),
  alertFailedGrowthThreshold: Number(process.env.ALERT_FAILED_GROWTH_THRESHOLD || 5),
};
