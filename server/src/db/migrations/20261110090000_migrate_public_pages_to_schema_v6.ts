import type { Knex } from 'knex';
import { z } from 'zod';

// v6 replaces section.layout with block/section sizes and adds page width, link width/alignment and the
// services layout. Everything else in the document is left untouched.
const MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION = 5 as const;
const MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION = 6 as const;

const MULTI_COLUMN_LAYOUTS = new Set([
  'two-equal', 'one-third-two-thirds', 'two-thirds-one-third', 'three-equal',
]);

const record = z.record(z.string(), z.unknown());
const blockSchema = z.object({ type: z.string(), design: z.looseObject({ linkStyle: record.nullable() }) }).passthrough();
const sectionSchema = z.object({
  layout: z.enum(['single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third', 'three-equal', 'stack', 'hero-overlay']),
  blocks: z.array(blockSchema),
  design: z.looseObject({ linkStyle: record }),
}).passthrough();
const sourceDocumentSchema = z.object({
  schemaVersion: z.literal(MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION),
  archivedBlocks: z.array(z.object({ block: blockSchema, sourceSectionId: z.string() }).passthrough()),
  sections: z.array(sectionSchema),
  theme: z.looseObject({ styleDefaults: z.looseObject({ linkStyle: record }) }),
}).passthrough();

type SourceBlock = z.infer<typeof blockSchema>;

function convertBlock(block: SourceBlock, size: 'full' | 'half') {
  const design = block.design.linkStyle === null
    ? block.design
    : { ...block.design, linkStyle: { ...block.design.linkStyle, width: null, align: null } };
  return {
    ...block,
    size,
    design,
    ...(block.type === 'services'
      ? { content: { ...(block.content as Record<string, unknown>), layout: 'carousel' } }
      : {}),
  };
}

export function convertPublicPageDocumentToSchemaV6(input: unknown) {
  const source = sourceDocumentSchema.parse(input);
  const { styleDefaults } = source.theme;
  return {
    ...source,
    schemaVersion: MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION,
    archivedBlocks: source.archivedBlocks.map((item) => ({ ...item, block: convertBlock(item.block, 'full') })),
    sections: source.sections.map(({ layout, blocks, design, ...section }) => {
      const blockSize = MULTI_COLUMN_LAYOUTS.has(layout) ? 'half' : 'full';
      return {
        ...section,
        size: 'full' as const,
        design: { ...design, linkStyle: { ...design.linkStyle, width: null, align: null } },
        blocks: blocks.map((block) => convertBlock(block, blockSize)),
      };
    }),
    theme: {
      ...source.theme,
      pageWidth: 'narrow' as const,
      styleDefaults: {
        ...styleDefaults,
        linkStyle: { ...styleDefaults.linkStyle, width: 'full', align: 'center' },
      },
    },
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
          return convertPublicPageDocumentToSchemaV6(row[snapshot]);
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
      DROP CONSTRAINT public_pages_draft_document_schema_v5_check,
      DROP CONSTRAINT public_pages_published_document_schema_v5_check`);
    for (const item of converted) {
      await trx('public_pages')
        .where({ id: item.row.id, account_id: item.row.account_id })
        .update({
          draft_document: item.draft,
          published_document: item.published,
        });
    }
    await trx.raw(`ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v6_check
        CHECK (draft_document @> '{"schemaVersion":6}'::jsonb),
      ADD CONSTRAINT public_pages_published_document_schema_v6_check
        CHECK (published_document IS NULL OR published_document @> '{"schemaVersion":6}'::jsonb)`);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v6 migration is forward-only');
}
