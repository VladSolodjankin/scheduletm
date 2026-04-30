import type { Knex } from 'knex';

const TABLE_NAME = 'web_user_integrations';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasZoomAccessToken = await knex.schema.hasColumn(TABLE_NAME, 'zoom_access_token');
  if (!hasZoomAccessToken) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.text('zoom_access_token');
      table.timestamp('zoom_token_expires_at', { useTz: true });
      table.timestamp('zoom_connected_at', { useTz: true });
      table.string('zoom_last_meeting_id', 255);
      table.text('zoom_last_join_url');
      table.text('zoom_last_start_url');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasZoomAccessToken = await knex.schema.hasColumn(TABLE_NAME, 'zoom_access_token');
  if (hasZoomAccessToken) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.dropColumns(
        'zoom_access_token',
        'zoom_token_expires_at',
        'zoom_connected_at',
        'zoom_last_meeting_id',
        'zoom_last_join_url',
        'zoom_last_start_url',
      );
    });
  }
}
