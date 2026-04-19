import type { Knex } from 'knex';

const CONSTRAINT_NAME = 'appointments_no_time_overlap';
const TRIGGER_NAME = 'set_appointment_end_at_trigger';
const FUNCTION_NAME = 'set_appointment_end_at';

export async function up(knex: Knex): Promise<void> {
  const hasAppointments = await knex.schema.hasTable('appointments');

  if (!hasAppointments) {
    return;
  }

  await knex.raw('CREATE EXTENSION IF NOT EXISTS btree_gist');

  // 1) Add stored end column
  await knex.schema.alterTable('appointments', (table) => {
    table.timestamp('appointment_end_at', { useTz: true }).nullable();
  });

  // 2) Backfill existing rows
  await knex.raw(`
    UPDATE appointments
    SET appointment_end_at = appointment_at + (duration_min * interval '1 minute')
    WHERE appointment_at IS NOT NULL
      AND duration_min IS NOT NULL
      AND appointment_end_at IS NULL
  `);

  // 3) Keep it in sync automatically
  await knex.raw(`
    CREATE OR REPLACE FUNCTION ${FUNCTION_NAME}()
    RETURNS trigger AS $$
    BEGIN
      NEW.appointment_end_at :=
        NEW.appointment_at + (NEW.duration_min * interval '1 minute');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON appointments
  `);

  await knex.raw(`
    CREATE TRIGGER ${TRIGGER_NAME}
    BEFORE INSERT OR UPDATE OF appointment_at, duration_min
    ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION ${FUNCTION_NAME}()
  `);

  // 4) Make sure column is present for all rows
  await knex.raw(`
    ALTER TABLE appointments
    ALTER COLUMN appointment_end_at SET NOT NULL
  `);

  // 5) Add overlap-prevention constraint
  await knex.raw(`
    ALTER TABLE appointments
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    EXCLUDE USING gist (
      account_id WITH =,
      specialist_id WITH =,
      tstzrange(
        appointment_at,
        appointment_end_at,
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

  await knex.raw(`
    ALTER TABLE appointments
    DROP CONSTRAINT IF EXISTS ${CONSTRAINT_NAME}
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON appointments
  `);

  await knex.raw(`
    DROP FUNCTION IF EXISTS ${FUNCTION_NAME}()
  `);

  const hasColumn = await knex.schema.hasColumn('appointments', 'appointment_end_at');
  if (hasColumn) {
    await knex.schema.alterTable('appointments', (table) => {
      table.dropColumn('appointment_end_at');
    });
  }
}
