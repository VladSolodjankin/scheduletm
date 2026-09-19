import type { Knex } from 'knex';

const META_PREFIX = 'meetingProvider: ';

function parseComment(comment: string | null): {
  meetingProvider: 'manual' | 'zoom' | 'offline';
  meetingLink: string;
  locationAddress: string;
  notes: string;
} {
  const lines = (comment ?? '').split('\n');
  let meetingProvider: 'manual' | 'zoom' | 'offline' = 'manual';
  let meetingLink = '';
  let locationAddress = '';
  const rest: string[] = [];

  for (const line of lines) {
    if (line.startsWith('meetingLink: ')) {
      meetingLink = line.slice('meetingLink: '.length).trim();
      continue;
    }
    if (line.startsWith(META_PREFIX)) {
      const parsed = line.slice(META_PREFIX.length).trim();
      meetingProvider = parsed === 'zoom' ? 'zoom' : parsed === 'offline' ? 'offline' : 'manual';
      continue;
    }
    if (line.startsWith('locationAddress: ')) {
      locationAddress = line.slice('locationAddress: '.length).trim();
      continue;
    }
    rest.push(line);
  }

  return { meetingProvider, meetingLink, locationAddress, notes: rest.join('\n').trim() };
}

function composeComment(meetingProvider: string, meetingLink: string | null, locationAddress: string | null, notes: string | null): string {
  const lines = [`${META_PREFIX}${meetingProvider}`];
  if (meetingLink) lines.push(`meetingLink: ${meetingLink}`);
  if (locationAddress) lines.push(`locationAddress: ${locationAddress}`);
  if (notes) lines.push(notes);
  return lines.join('\n');
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('appointments', (table) => {
    table.string('meeting_link', 2048);
    table.string('meeting_provider', 20).notNullable().defaultTo('manual');
    table.string('location_address', 500);
  });

  await knex.raw(
    'ALTER TABLE "appointments" ADD CONSTRAINT "appointments_meeting_provider_check" CHECK (meeting_provider IN (\'manual\',\'zoom\',\'offline\'))',
  );

  const rows = await knex('appointments')
    .whereNotNull('comment')
    .andWhere('comment', 'like', `${META_PREFIX}%`)
    .select<Array<{ id: number; comment: string }>>('id', 'comment');

  for (const row of rows) {
    const parsed = parseComment(row.comment);
    await knex('appointments').where({ id: row.id }).update({
      meeting_provider: parsed.meetingProvider,
      meeting_link: parsed.meetingLink || null,
      location_address: parsed.locationAddress || null,
      comment: parsed.notes || null,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const rows = await knex('appointments')
    .select<Array<{ id: number; comment: string | null; meeting_provider: string; meeting_link: string | null; location_address: string | null }>>(
      'id', 'comment', 'meeting_provider', 'meeting_link', 'location_address',
    );

  for (const row of rows) {
    await knex('appointments').where({ id: row.id }).update({
      comment: composeComment(row.meeting_provider, row.meeting_link, row.location_address, row.comment),
    });
  }

  await knex.raw('ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_meeting_provider_check"');
  await knex.schema.alterTable('appointments', (table) => {
    table.dropColumn('meeting_link');
    table.dropColumn('meeting_provider');
    table.dropColumn('location_address');
  });
}
