import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasClientsPreferred = await knex.schema.hasColumn('clients', 'preferred_meeting_provider');
  if (!hasClientsPreferred) {
    await knex.schema.alterTable('clients', (table) => {
      table.string('preferred_meeting_provider', 32).nullable();
    });
    await knex.raw("ALTER TABLE \"clients\" ADD CONSTRAINT \"clients_preferred_meeting_provider_check\" CHECK (preferred_meeting_provider IN ('manual','zoom') OR preferred_meeting_provider IS NULL)");
  }

  const hasPriority = await knex.schema.hasColumn('specialist_booking_policies', 'meeting_providers_priority');
  if (!hasPriority) {
    await knex.schema.alterTable('specialist_booking_policies', (table) => {
      table.string('meeting_providers_priority', 120).notNullable().defaultTo('zoom,manual');
      table.string('allowed_meeting_providers', 120).notNullable().defaultTo('zoom,manual');
      table.boolean('meeting_provider_override_enabled').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasPriority = await knex.schema.hasColumn('specialist_booking_policies', 'meeting_providers_priority');
  if (hasPriority) {
    await knex.schema.alterTable('specialist_booking_policies', (table) => {
      table.dropColumn('meeting_provider_override_enabled');
      table.dropColumn('allowed_meeting_providers');
      table.dropColumn('meeting_providers_priority');
    });
  }

  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_preferred_meeting_provider_check"');
  const hasClientsPreferred = await knex.schema.hasColumn('clients', 'preferred_meeting_provider');
  if (hasClientsPreferred) {
    await knex.schema.alterTable('clients', (table) => {
      table.dropColumn('preferred_meeting_provider');
    });
  }
}
