import type { Knex } from 'knex';

const SPECIALISTS_TABLE = 'specialists';
const APP_SETTINGS_TABLE = 'app_settings';

const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 20;
const DEFAULT_SLOT_DURATION_MIN = 90;
const DEFAULT_SLOT_STEP_MIN = 30;

export async function up(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  if (!hasSpecialists) {
    return;
  }

  const hasWorkStartHour = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'work_start_hour');
  const hasWorkEndHour = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'work_end_hour');
  const hasSlotDurationMin = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'slot_duration_min');
  const hasSlotStepMin = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'slot_step_min');

  await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
    if (!hasWorkStartHour) {
      table.integer('work_start_hour').notNullable().defaultTo(DEFAULT_WORK_START_HOUR);
    }

    if (!hasWorkEndHour) {
      table.integer('work_end_hour').notNullable().defaultTo(DEFAULT_WORK_END_HOUR);
    }

    if (!hasSlotDurationMin) {
      table.integer('slot_duration_min').notNullable().defaultTo(DEFAULT_SLOT_DURATION_MIN);
    }

    if (!hasSlotStepMin) {
      table.integer('slot_step_min').notNullable().defaultTo(DEFAULT_SLOT_STEP_MIN);
    }
  });

  const hasAppSettings = await knex.schema.hasTable(APP_SETTINGS_TABLE);
  if (!hasAppSettings) {
    return;
  }

  await knex.raw(
    `
      UPDATE specialists AS s
      SET
        work_start_hour = COALESCE(a.work_start_hour, ?),
        work_end_hour = COALESCE(a.work_end_hour, ?),
        slot_duration_min = COALESCE(a.slot_duration_min, ?)
      FROM (
        SELECT DISTINCT ON (account_id)
          account_id,
          work_start_hour,
          work_end_hour,
          slot_duration_min
        FROM app_settings
        ORDER BY account_id, id ASC
      ) AS a
      WHERE a.account_id = s.account_id
    `,
    [DEFAULT_WORK_START_HOUR, DEFAULT_WORK_END_HOUR, DEFAULT_SLOT_DURATION_MIN],
  );
}

export async function down(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  if (!hasSpecialists) {
    return;
  }

  const hasWorkStartHour = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'work_start_hour');
  const hasWorkEndHour = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'work_end_hour');
  const hasSlotDurationMin = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'slot_duration_min');
  const hasSlotStepMin = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'slot_step_min');

  await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
    if (hasWorkStartHour) {
      table.dropColumn('work_start_hour');
    }

    if (hasWorkEndHour) {
      table.dropColumn('work_end_hour');
    }

    if (hasSlotDurationMin) {
      table.dropColumn('slot_duration_min');
    }

    if (hasSlotStepMin) {
      table.dropColumn('slot_step_min');
    }
  });
}
