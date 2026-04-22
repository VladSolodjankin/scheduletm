import type { Knex } from 'knex';

const TABLE_NAME = 'clients';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasTimezone = await knex.schema.hasColumn(TABLE_NAME, 'timezone');
  if (!hasTimezone) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.string('timezone', 64).notNullable().defaultTo('UTC');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasTimezone = await knex.schema.hasColumn(TABLE_NAME, 'timezone');
  if (hasTimezone) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.dropColumn('timezone');
    });
  }
}
