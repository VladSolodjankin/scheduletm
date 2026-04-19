import type { Knex } from 'knex';

const CONSTRAINT_NAME = 'appointments_no_time_overlap';

export async function up(knex: Knex): Promise<void> {
  const hasAppointments = await knex.schema.hasTable('appointments');

  if (!hasAppointments) {
    return;
  }

  await knex.raw('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await knex.raw(`
    ALTER TABLE appointments
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    EXCLUDE USING gist (
      account_id WITH =,
      specialist_id WITH =,
      tstzrange(
        appointment_at,
        appointment_at + (duration_min * interval '1 minute'),
        '[)'
      ) WITH &&
    )
    WHERE (status <> 'cancelled')
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasAppointments = await knex.schema.hasTable('appointments');

  if (!hasAppointments) {
    return;
  }

  await knex.raw(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS ${CONSTRAINT_NAME}`);
}
