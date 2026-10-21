import { createHmac } from 'node:crypto';
import { env } from '../config/env';

/** Per-account secret Telegram echoes back for an account's own bot; derived, so nothing extra is stored. */
export function customBotWebhookSecret(accountId: number): string {
  return createHmac('sha256', env.webhookSecret).update(`custom-bot:${accountId}`).digest('hex');
}
