import type { Knex } from 'knex';

const TABLE = 'specialist_settings';
const COLUMN = 'default_meeting_link';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn(TABLE, COLUMN)) {
    await knex.schema.alterTable(TABLE, (table) => {
      table.dropColumn(COLUMN);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(TABLE, COLUMN))) {
    await knex.schema.alterTable(TABLE, (table) => {
      table.string(COLUMN, 2048).nullable();
    });
  }
}
