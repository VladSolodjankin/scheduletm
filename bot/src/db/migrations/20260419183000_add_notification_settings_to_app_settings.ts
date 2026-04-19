import type { Knex } from 'knex';

const DEFAULT_REMINDER_OFFSETS_MIN = '1440,60,30';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('app_settings');
  if (!hasTable) {
    return;
  }

  const hasReminderOffsets = await knex.schema.hasColumn('app_settings', 'reminder_offsets_min');
  const hasReminderComment = await knex.schema.hasColumn('app_settings', 'reminder_comment');

  await knex.schema.alterTable('app_settings', (table) => {
    if (!hasReminderOffsets) {
      table.string('reminder_offsets_min').notNullable().defaultTo(DEFAULT_REMINDER_OFFSETS_MIN);
    }

    if (!hasReminderComment) {
      table.text('reminder_comment').notNullable().defaultTo('');
    }
  });

  await knex('app_settings')
    .whereNull('reminder_offsets_min')
    .orWhere('reminder_offsets_min', '')
    .update({ reminder_offsets_min: DEFAULT_REMINDER_OFFSETS_MIN });

  await knex('app_settings')
    .whereNull('reminder_comment')
    .update({ reminder_comment: '' });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('app_settings');
  if (!hasTable) {
    return;
  }

  const hasReminderComment = await knex.schema.hasColumn('app_settings', 'reminder_comment');
  const hasReminderOffsets = await knex.schema.hasColumn('app_settings', 'reminder_offsets_min');

  await knex.schema.alterTable('app_settings', (table) => {
    if (hasReminderComment) {
      table.dropColumn('reminder_comment');
    }

    if (hasReminderOffsets) {
      table.dropColumn('reminder_offsets_min');
    }
  });
}
