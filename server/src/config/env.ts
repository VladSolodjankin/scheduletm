import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3003),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_BASE_URL: z.string().url().default('http://localhost:3003'),
  SESSION_COOKIE_NAME: z.string().default('scheduletm_refresh'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BREVO_API_KEY: z.string().default(''),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@meetli.cc'),
  EMAIL_FROM_NAME: z.string().default('Meetli'),
  EMAIL_VERIFY_BASE_URL: z.string().url().default('http://localhost:5173'),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().default('http://localhost:3003/api/integrations/google/oauth/callback'),
  GOOGLE_OAUTH_SCOPES: z.string().default(''),
  APP_ENCRYPTION_KEY: z.string().default(''),
});

export const env = envSchema.parse(process.env);
