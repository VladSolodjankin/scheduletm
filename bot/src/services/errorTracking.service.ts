import { db } from '../db/knex';

const ERROR_MESSAGE_MAX = 2000;
const ERROR_STACK_MAX = 6000;

function normalizeText(value: unknown, max: number): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, max);
}

export async function trackBotError(input: {
  method?: string | null;
  path?: string | null;
  error: unknown;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const error = input.error instanceof Error ? input.error : new Error(String(input.error ?? 'Unknown bot error'));
  const message = normalizeText(error.message, ERROR_MESSAGE_MAX) || 'Bot error';
  const stack = normalizeText(error.stack, ERROR_STACK_MAX) || null;

  try {
    await db('error_logs').insert({
      account_id: null,
      web_user_id: null,
      source: 'bot',
      level: 'error',
      method: input.method?.slice(0, 16) ?? null,
      path: input.path?.slice(0, 255) ?? null,
      message,
      stack,
      metadata_json: input.metadata ?? null,
      created_at: db.fn.now(),
    });
  } catch (trackingError) {
    console.error('[error-tracking] trackBotError failed', trackingError);
    console.error('[error-tracking] original bot error', error);
  }
}
