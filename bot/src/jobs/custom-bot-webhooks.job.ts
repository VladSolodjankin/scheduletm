import { createHash } from 'node:crypto';
import { setCustomBotWebhook } from '../bot/bot';
import { listCustomBots, markCustomBotWebhookRegistered } from '../repositories/bot-access.repository';
import { logError, logInfo } from '../utils/logger';
import { customBotWebhookSecret } from '../utils/webhook-secret';

const DEFAULT_INTERVAL_MS = 60_000;

/** Registers the webhook of every account's own bot whose token is new or changed since the last run. */
export async function syncCustomBotWebhooks(): Promise<number> {
  let registered = 0;

  for (const bot of await listCustomBots()) {
    const hash = createHash('sha256').update(bot.token).digest('hex');
    if (bot.registeredHash === hash) {
      continue;
    }

    try {
      await setCustomBotWebhook(bot.token, bot.accountId, customBotWebhookSecret(bot.accountId));
      await markCustomBotWebhookRegistered(bot.accountId, hash);
      registered += 1;
    } catch {
      // The error text is withheld on purpose: Telegram errors can echo the bot token in the URL.
      logError('custom_bot.webhook_set_failed', { account_id: bot.accountId });
    }
  }

  return registered;
}

export function startCustomBotWebhookJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const run = async () => {
    try {
      const registered = await syncCustomBotWebhooks();
      if (registered > 0) {
        logInfo('custom_bot.webhooks_registered', { registered });
      }
    } catch (error) {
      logError('custom_bot.webhook_job_failed', { error });
    }
  };

  void run();
  const timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
}
