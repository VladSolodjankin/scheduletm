import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('account_settings');
  if (!hasTable) return;

  const hasAddress = await knex.schema.hasColumn('account_settings', 'business_address');
  if (!hasAddress) {
    await knex.schema.alterTable('account_settings', (table) => {
      table.string('business_address', 512).notNullable().defaultTo('');
    });
  }

  const hasLat = await knex.schema.hasColumn('account_settings', 'business_lat');
  if (!hasLat) {
    await knex.schema.alterTable('account_settings', (table) => {
      table.decimal('business_lat', 10, 7).nullable();
    });
  }

  const hasLng = await knex.schema.hasColumn('account_settings', 'business_lng');
  if (!hasLng) {
    await knex.schema.alterTable('account_settings', (table) => {
      table.decimal('business_lng', 10, 7).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('account_settings');
  if (!hasTable) return;

  const hasAddress = await knex.schema.hasColumn('account_settings', 'business_address');
  const hasLat = await knex.schema.hasColumn('account_settings', 'business_lat');
  const hasLng = await knex.schema.hasColumn('account_settings', 'business_lng');

  if (hasAddress || hasLat || hasLng) {
    await knex.schema.alterTable('account_settings', (table) => {
      if (hasAddress) table.dropColumn('business_address');
      if (hasLat) table.dropColumn('business_lat');
      if (hasLng) table.dropColumn('business_lng');
    });
  }
}
