import type { Knex } from 'knex';

// allowed_meeting_providers becomes an ordered list: its order is the provider priority.
export async function up(knex: Knex): Promise<void> {
  const rows = await knex('specialist_booking_policies')
    .select<Array<{ id: number; allowed_meeting_providers: string; meeting_providers_priority: string }>>(
      'id', 'allowed_meeting_providers', 'meeting_providers_priority',
    );

  for (const row of rows) {
    const allowed = row.allowed_meeting_providers.split(',').map((item) => item.trim()).filter(Boolean);
    const priority = row.meeting_providers_priority.split(',').map((item) => item.trim()).filter(Boolean);
    const ordered = [
      ...priority.filter((item) => allowed.includes(item)),
      ...allowed,
    ].filter((item, index, list) => list.indexOf(item) === index);
    await knex('specialist_booking_policies')
      .where({ id: row.id })
      .update({ allowed_meeting_providers: ordered.join(',') });
  }

  await knex.schema.alterTable('specialist_booking_policies', (table) => {
    table.dropColumn('meeting_providers_priority');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('specialist_booking_policies', (table) => {
    table.string('meeting_providers_priority', 120).notNullable().defaultTo('offline,zoom,manual');
  });
  await knex.raw('UPDATE specialist_booking_policies SET meeting_providers_priority = allowed_meeting_providers');
}
