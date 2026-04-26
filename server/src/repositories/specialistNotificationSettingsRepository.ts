import { db } from '../db/knex.js';

export type SpecialistNotificationSettingRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  notification_type: string;
  preferred_channel: string;
  enabled: boolean;
  send_timings: unknown;
  frequency: string;
};

export async function findSpecialistNotificationSettings(
  accountId: number,
  specialistId: number,
): Promise<SpecialistNotificationSettingRecord[]> {
  return db('specialist_notification_settings')
    .where({ account_id: accountId, specialist_id: specialistId })
    .select<SpecialistNotificationSettingRecord[]>('*');
}

export async function upsertSpecialistNotificationSettings(
  accountId: number,
  specialistId: number,
  items: Array<{
    notificationType: string;
    preferredChannel: string;
    enabled: boolean;
    sendTimings: string[];
    frequency: string;
  }>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  await db('specialist_notification_settings')
    .insert(items.map((item) => ({
      account_id: accountId,
      specialist_id: specialistId,
      notification_type: item.notificationType,
      preferred_channel: item.preferredChannel,
      enabled: item.enabled,
      send_timings: JSON.stringify(item.sendTimings),
      frequency: item.frequency,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })))
    .onConflict(['account_id', 'specialist_id', 'notification_type', 'preferred_channel'])
    .merge({
      enabled: db.raw('excluded.enabled'),
      send_timings: db.raw('excluded.send_timings'),
      frequency: db.raw('excluded.frequency'),
      updated_at: db.fn.now(),
    });
}
