import type { Knex } from 'knex';
import { z } from 'zod';

// v7 removes the page profile (display name, description, logo, profile photo): everything a visitor sees is
// built from sections and blocks now. Media that only the profile referenced is dropped with it.
const MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION = 6 as const;
const MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION = 7 as const;

const sourceDocumentSchema = z.object({
  schemaVersion: z.literal(MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION),
  profile: z.unknown(),
  media: z.array(z.looseObject({ id: z.string() })),
}).passthrough();

function collectMediaIds(value: unknown, ids: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaIds(item, ids));
  } else if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, item]) => {
      if (/mediaId$/i.test(key) && typeof item === 'string') ids.add(item);
      collectMediaIds(item, ids);
    });
  }
}

export function convertPublicPageDocumentToSchemaV7(input: unknown) {
  const { profile: _profile, ...source } = sourceDocumentSchema.parse(input);
  const referenced = new Set<string>();
  collectMediaIds({ ...source, media: undefined }, referenced);
  return {
    ...source,
    schemaVersion: MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION,
    media: source.media.filter((media) => referenced.has(media.id)),
  };
}

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const rows = await trx('public_pages as p')
      .select<{
        id: string;
        account_id: number;
        draft_document: unknown;
        published_document: unknown | null;
      }[]>('p.id', 'p.account_id', 'p.draft_document', 'p.published_document')
      .forUpdate();
    const converted = rows.map((row) => {
      const convert = (snapshot: 'draft_document' | 'published_document') => {
        if (snapshot === 'published_document' && row[snapshot] === null) return null;
        try {
          return convertPublicPageDocumentToSchemaV7(row[snapshot]);
        } catch (error) {
          throw new Error(
            `Public Page ${row.id} ${snapshot}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };
      return { row, draft: convert('draft_document'), published: convert('published_document') };
    });

    await trx.raw(`ALTER TABLE public_pages
      DROP CONSTRAINT public_pages_draft_document_schema_v6_check,
      DROP CONSTRAINT public_pages_published_document_schema_v6_check`);
    for (const item of converted) {
      await trx('public_pages')
        .where({ id: item.row.id, account_id: item.row.account_id })
        .update({ draft_document: item.draft, published_document: item.published });
    }
    await trx.raw(`ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v7_check
        CHECK (draft_document @> '{"schemaVersion":7}'::jsonb),
      ADD CONSTRAINT public_pages_published_document_schema_v7_check
        CHECK (published_document IS NULL OR published_document @> '{"schemaVersion":7}'::jsonb)`);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v7 migration is forward-only');
}
