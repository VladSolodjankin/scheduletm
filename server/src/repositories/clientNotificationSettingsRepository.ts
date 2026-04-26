import { db } from '../db/knex.js';

export type ClientNotificationSettingRecord = {
  id: number;
  account_id: number;
  client_id: number;
  notification_type: string;
  channel: string;
  enabled: boolean;
};

export async function findClientNotificationSettings(
  accountId: number,
  clientId: number,
): Promise<ClientNotificationSettingRecord[]> {
  return db('client_notification_settings')
    .where({ account_id: accountId, client_id: clientId })
    .select<ClientNotificationSettingRecord[]>('*');
}

export async function upsertClientNotificationSettings(
  accountId: number,
  clientId: number,
  items: Array<{
    notificationType: string;
    channel: string;
    enabled: boolean;
  }>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  await db('client_notification_settings')
    .insert(items.map((item) => ({
      account_id: accountId,
      client_id: clientId,
      notification_type: item.notificationType,
      channel: item.channel,
      enabled: item.enabled,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })))
    .onConflict(['account_id', 'client_id', 'notification_type', 'channel'])
    .merge({
      enabled: db.raw('excluded.enabled'),
      updated_at: db.fn.now(),
    });
}
