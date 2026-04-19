import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable('specialists');
  const hasServices = await knex.schema.hasTable('services');

  if (hasSpecialists) {
    const hasBaseSessionPrice = await knex.schema.hasColumn('specialists', 'base_session_price');
    const hasBaseHourPrice = await knex.schema.hasColumn('specialists', 'base_hour_price');

    await knex.schema.alterTable('specialists', (table) => {
      if (!hasBaseSessionPrice) {
        table.integer('base_session_price').notNullable().defaultTo(0);
      }
      if (!hasBaseHourPrice) {
        table.integer('base_hour_price').notNullable().defaultTo(0);
      }
    });
  }

  if (hasSpecialists && hasServices) {
    await knex.raw(`
      UPDATE services s
      SET price = CASE
        WHEN sp.base_session_price > 0 THEN sp.base_session_price * s.sessions_count
        WHEN sp.base_hour_price > 0 THEN ROUND(sp.base_hour_price * (s.duration_min::numeric / 60.0) * s.sessions_count)::int
        ELSE 0
      END
      FROM specialists sp
      WHERE s.account_id = sp.account_id
        AND sp.is_active = true
        AND sp.is_default = true;
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable('specialists');
  if (!hasSpecialists) {
    return;
  }

  const hasBaseSessionPrice = await knex.schema.hasColumn('specialists', 'base_session_price');
  const hasBaseHourPrice = await knex.schema.hasColumn('specialists', 'base_hour_price');

  await knex.schema.alterTable('specialists', (table) => {
    if (hasBaseSessionPrice) {
      table.dropColumn('base_session_price');
    }
    if (hasBaseHourPrice) {
      table.dropColumn('base_hour_price');
    }
  });
}
