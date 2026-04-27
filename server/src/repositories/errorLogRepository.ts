import { db } from '../db/knex.js';

export type ErrorLogRecord = {
  id: number;
  account_id: number | null;
  web_user_id: number | null;
  source: 'web' | 'server';
  level: string;
  method: string | null;
  path: string | null;
  message: string;
  stack: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
};

export async function insertErrorLog(input: {
  accountId?: number | null;
  webUserId?: number | null;
  source: 'web' | 'server';
  method?: string | null;
  path?: string | null;
  message: string;
  stack?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db('error_logs').insert({
    account_id: input.accountId ?? null,
    web_user_id: input.webUserId ?? null,
    source: input.source,
    level: 'error',
    method: input.method ?? null,
    path: input.path ?? null,
    message: input.message,
    stack: input.stack ?? null,
    metadata_json: input.metadata ?? null,
    created_at: db.fn.now(),
  });
}

export async function listErrorLogs(filters: {
  source?: 'web' | 'server';
  accountId?: number;
  limit?: number;
}): Promise<ErrorLogRecord[]> {
  const query = db('error_logs').orderBy('created_at', 'desc').limit(filters.limit ?? 300);

  if (filters.source) {
    query.where('source', filters.source);
  }

  if (filters.accountId !== undefined) {
    query.where('account_id', filters.accountId);
  }

  return query.select<ErrorLogRecord[]>('*');
}

export async function purgeExpiredErrorLogs(retentionDays = 7): Promise<number> {
  const result = await db('error_logs')
    .whereRaw('created_at < NOW() - (? * INTERVAL \'1 day\')', [retentionDays])
    .delete();

  return result;
}
