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
  port: Number(process.env.PORT || 3000),
  botToken: getEnv("BOT_TOKEN"),
  webhookSecret: getEnv("WEBHOOK_SECRET"),
  appUrl: getEnv("APP_URL"),
};
