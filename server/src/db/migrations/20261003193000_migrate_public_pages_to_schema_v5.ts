import type { Knex } from 'knex';
import { z } from 'zod';

// Theme and the rest of the document are unchanged by this migration; only theme.linkTextAlign is added.
const MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION = 4 as const;
const MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION = 5 as const;
const DEFAULT_LINK_TEXT_ALIGN = 'center' as const;

const sourceThemeSchema = z.object({ linkTextAlign: z.enum(['center', 'left']).optional() }).passthrough();
const targetThemeSchema = z.object({ linkTextAlign: z.enum(['center', 'left']) }).passthrough();
const unchangedDocumentFields = {
  timezone: z.unknown(),
  archivedBlocks: z.unknown(),
  id: z.unknown(),
  slug: z.unknown(),
  status: z.unknown(),
  profile: z.unknown(),
  sections: z.unknown(),
  seo: z.unknown(),
  media: z.unknown(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
};
const sourceDocumentSchema = z.object({
  ...unchangedDocumentFields,
  schemaVersion: z.literal(MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION),
  theme: sourceThemeSchema,
}).strict();
const targetDocumentSchema = z.object({
  ...unchangedDocumentFields,
  schemaVersion: z.literal(MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION),
  theme: targetThemeSchema,
}).strict();

export function convertPublicPageDocumentToSchemaV5(input: unknown) {
  const source = sourceDocumentSchema.parse(input);
  return targetDocumentSchema.parse({
    ...source,
    schemaVersion: MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION,
    theme: { ...source.theme, linkTextAlign: source.theme.linkTextAlign ?? DEFAULT_LINK_TEXT_ALIGN },
  });
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
          return convertPublicPageDocumentToSchemaV5(row[snapshot]);
        } catch (error) {
          throw new Error(
            `Public Page ${row.id} ${snapshot}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };
      return {
        row,
        draft: convert('draft_document'),
        published: convert('published_document'),
      };
    });

    await trx.raw(`ALTER TABLE public_pages
      DROP CONSTRAINT public_pages_draft_document_schema_v4_check,
      DROP CONSTRAINT public_pages_published_document_schema_v4_check`);
    for (const item of converted) {
      await trx('public_pages')
        .where({ id: item.row.id, account_id: item.row.account_id })
        .update({
          draft_document: item.draft,
          published_document: item.published,
        });
    }
    await trx.raw(`ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v5_check
        CHECK (draft_document @> '{"schemaVersion":5}'::jsonb),
      ADD CONSTRAINT public_pages_published_document_schema_v5_check
        CHECK (published_document IS NULL OR published_document @> '{"schemaVersion":5}'::jsonb)`);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v5 migration is forward-only');
}
