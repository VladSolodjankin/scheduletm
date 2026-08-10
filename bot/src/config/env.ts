import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}

function getNonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT || 3002),
  webhookSecret: getEnv("WEBHOOK_SECRET"),
  appUrl: getEnv("APP_URL"),
  emailVerifyBaseUrl: process.env.EMAIL_VERIFY_BASE_URL ?? getEnv("APP_URL"),
  brevoApiKey: process.env.BREVO_API_KEY ?? '',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@meetli.cc',
  emailFromName: process.env.EMAIL_FROM_NAME ?? 'Meetli',
  autoSetWebhook: process.env.AUTO_SET_WEBHOOK === '1' || process.env.AUTO_SET_WEBHOOK === 'true',
  notificationPollMs: Number(process.env.NOTIFICATION_POLL_MS || 60000),
  alertPollMs: Number(process.env.ALERT_POLL_MS || 60000),
  alertNoUpdatesThresholdMs: Number(process.env.ALERT_NO_UPDATES_THRESHOLD_MS || 15 * 60 * 1000),
  alertFailedGrowthThreshold: Number(process.env.ALERT_FAILED_GROWTH_THRESHOLD || 5),
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY ?? '',
  webhookRateLimit: getPositiveNumber('WEBHOOK_RATE_LIMIT', 60),
  webhookRateLimitWindowMs: getPositiveNumber('WEBHOOK_RATE_LIMIT_WINDOW_MS', 60_000),
  trustedProxyHops: getNonNegativeInteger('TRUSTED_PROXY_HOPS', 0),
  userSessionRetentionMs: getPositiveNumber(
    'TELEGRAM_USER_SESSION_RETENTION_MS',
    30 * 24 * 60 * 60 * 1000,
  ),
  userSessionCleanupIntervalMs: getPositiveNumber(
    'TELEGRAM_USER_SESSION_CLEANUP_INTERVAL_MS',
    24 * 60 * 60 * 1000,
  ),
};
