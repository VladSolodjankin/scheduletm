import type { Knex } from 'knex';
import { z } from 'zod';
import {
  publicPageDocumentSchema as frozenPublicPageDocumentSchemaV3,
} from './20260910160000_migrate_public_pages_to_schema_v3.js';

// The complete source contract is frozen in the immutable v3 migration; v4 additions stay pinned here.
const MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION = 3 as const;
const MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION = 4 as const;
const DEFAULT_AVATAR_POSITION = '50% 50%' as const;

const nullableString = z.string().nullable();
const percentagePositionSchema = z.string().regex(
  /^(?:0|[1-9]\d?|100)% (?:0|[1-9]\d?|100)%$/,
  'invalid_percentage_position',
);
const sourceProfileSchema = z.object({
  displayName: z.string(),
  description: z.string(),
  logoMediaId: nullableString,
  avatarMediaId: nullableString,
}).strict();
const targetProfileSchema = sourceProfileSchema.extend({
  avatarPosition: percentagePositionSchema,
}).strict();
const sourceDocumentSchema = frozenPublicPageDocumentSchemaV3.refine(
  (document) => document.schemaVersion === MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION,
  'invalid_source_schema_version',
);
const unchangedDocumentFields = {
  timezone: z.unknown(),
  archivedBlocks: z.unknown(),
  id: z.unknown(),
  slug: z.unknown(),
  status: z.unknown(),
  theme: z.unknown(),
  sections: z.unknown(),
  seo: z.unknown(),
  media: z.unknown(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
};
const targetDocumentSchema = z.object({
  ...unchangedDocumentFields,
  schemaVersion: z.literal(MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION),
  profile: targetProfileSchema,
}).strict();

export function convertPublicPageDocumentToSchemaV4(input: unknown) {
  const source = sourceDocumentSchema.parse(input);
  return targetDocumentSchema.parse({
    ...source,
    schemaVersion: MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION,
    profile: {
      ...source.profile,
      avatarPosition: DEFAULT_AVATAR_POSITION,
    },
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
          return convertPublicPageDocumentToSchemaV4(row[snapshot]);
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
      DROP CONSTRAINT public_pages_draft_document_schema_v3_check,
      DROP CONSTRAINT public_pages_published_document_schema_v3_check`);
    for (const item of converted) {
      await trx('public_pages')
        .where({ id: item.row.id, account_id: item.row.account_id })
        .update({
          draft_document: item.draft,
          published_document: item.published,
        });
    }
    await trx.raw(`ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v4_check
        CHECK (draft_document @> '{"schemaVersion":4}'::jsonb),
      ADD CONSTRAINT public_pages_published_document_schema_v4_check
        CHECK (published_document IS NULL OR published_document @> '{"schemaVersion":4}'::jsonb)`);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v4 migration is forward-only');
}
