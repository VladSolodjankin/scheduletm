import { db } from '../db/knex.js';
import type { AccountNotificationDefault } from '../services/notificationSettingsService.js';

export type AccountNotificationDefaultRecord = {
  id: number;
  account_id: number;
  notification_type: string;
  preferred_channel: string;
  enabled: boolean;
  send_timings: unknown;
  frequency: string;
};

export async function findAccountNotificationDefaults(accountId: number): Promise<AccountNotificationDefaultRecord[]> {
  return db('account_notification_defaults')
    .where({ account_id: accountId })
    .select<AccountNotificationDefaultRecord[]>('*');
}

export async function ensureAccountNotificationDefaults(
  accountId: number,
  defaults: AccountNotificationDefault[],
): Promise<void> {
  if (defaults.length === 0) {
    return;
  }

  await db('account_notification_defaults')
    .insert(
      defaults.map((item) => ({
        account_id: accountId,
        notification_type: item.notificationType,
        preferred_channel: item.preferredChannel,
        enabled: item.enabled,
        send_timings: JSON.stringify(item.sendTimings),
        frequency: item.frequency,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })),
    )
    .onConflict(['account_id', 'notification_type', 'preferred_channel'])
    .ignore();
}

export async function listAccountIdsWithoutNotificationDefaults(limit: number): Promise<number[]> {
  const rows = await db('accounts as a')
    .leftJoin('account_notification_defaults as andf', 'andf.account_id', 'a.id')
    .whereNull('andf.id')
    .groupBy('a.id')
    .orderBy('a.id', 'asc')
    .limit(limit)
    .select<{ id: number }[]>('a.id');

  return rows.map((row) => row.id);
}
