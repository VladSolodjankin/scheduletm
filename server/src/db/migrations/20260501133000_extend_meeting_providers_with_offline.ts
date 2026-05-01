import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_preferred_meeting_provider_check"');
  await knex.raw("ALTER TABLE \"clients\" ADD CONSTRAINT \"clients_preferred_meeting_provider_check\" CHECK (preferred_meeting_provider IN ('manual','zoom','offline') OR preferred_meeting_provider IS NULL)");

  await knex('specialist_booking_policies')
    .update({
      meeting_providers_priority: knex.raw("replace(meeting_providers_priority, 'zoom,manual', 'offline,zoom,manual')"),
      allowed_meeting_providers: knex.raw("replace(allowed_meeting_providers, 'zoom,manual', 'offline,zoom,manual')"),
    });

  await knex.schema.alterTable('specialist_booking_policies', (table) => {
    table.string('meeting_providers_priority', 120).notNullable().defaultTo('offline,zoom,manual').alter();
    table.string('allowed_meeting_providers', 120).notNullable().defaultTo('offline,zoom,manual').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_preferred_meeting_provider_check"');
  await knex.raw("ALTER TABLE \"clients\" ADD CONSTRAINT \"clients_preferred_meeting_provider_check\" CHECK (preferred_meeting_provider IN ('manual','zoom') OR preferred_meeting_provider IS NULL)");

  await knex('specialist_booking_policies')
    .update({
      meeting_providers_priority: knex.raw("replace(meeting_providers_priority, 'offline,zoom,manual', 'zoom,manual')"),
      allowed_meeting_providers: knex.raw("replace(allowed_meeting_providers, 'offline,zoom,manual', 'zoom,manual')"),
    });

  await knex.schema.alterTable('specialist_booking_policies', (table) => {
    table.string('meeting_providers_priority', 120).notNullable().defaultTo('zoom,manual').alter();
    table.string('allowed_meeting_providers', 120).notNullable().defaultTo('zoom,manual').alter();
  });
}
