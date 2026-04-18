import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('app_settings');
  if (!hasTable) {
    return;
  }

  const existing = await knex('app_settings').first('id');
  if (!existing) {
    await knex('app_settings').insert({
      timezone: 'Europe/Moscow',
      work_start_hour: 9,
      work_end_hour: 20,
      work_days: '1,2,3,4,5,6',
      slot_duration_min: 90,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('app_settings');
  if (!hasTable) {
    return;
  }

  await knex('app_settings')
    .where({
      timezone: 'Europe/Moscow',
      work_start_hour: 9,
      work_end_hour: 20,
      work_days: '1,2,3,4,5,6',
      slot_duration_min: 90,
    })
    .del();
}
