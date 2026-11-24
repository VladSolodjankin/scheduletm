import type { Knex } from 'knex';
import { z } from 'zod';

// v8 stores the language of the page's public strings (booking button, reviews, form labels, ...).
// Existing pages get the language of the account that owns them.
const MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION = 7 as const;
const MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION = 8 as const;

const sourceDocumentSchema = z.object({
  schemaVersion: z.literal(MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION),
}).passthrough();

export function publicPageLocaleFromAccountLocale(accountLocale: string | null): 'ru' | 'en' {
  return accountLocale?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function convertPublicPageDocumentToSchemaV8(input: unknown, accountLocale: string | null) {
  return {
    ...sourceDocumentSchema.parse(input),
    schemaVersion: MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION,
    locale: publicPageLocaleFromAccountLocale(accountLocale),
  };
}

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const rows = await trx('public_pages as p')
      .leftJoin('account_settings as s', 's.account_id', 'p.account_id')
      .select<{
        id: string;
        account_id: number;
        account_locale: string | null;
        draft_document: unknown;
        published_document: unknown | null;
      }[]>('p.id', 'p.account_id', 's.locale as account_locale', 'p.draft_document', 'p.published_document')
      .forUpdate('p');
    const converted = rows.map((row) => {
      const convert = (snapshot: 'draft_document' | 'published_document') => {
        if (snapshot === 'published_document' && row[snapshot] === null) return null;
        try {
          return convertPublicPageDocumentToSchemaV8(row[snapshot], row.account_locale);
        } catch (error) {
          throw new Error(
            `Public Page ${row.id} ${snapshot}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };
      return { row, draft: convert('draft_document'), published: convert('published_document') };
    });

    await trx.raw(`ALTER TABLE public_pages
      DROP CONSTRAINT public_pages_draft_document_schema_v7_check,
      DROP CONSTRAINT public_pages_published_document_schema_v7_check`);
    for (const item of converted) {
      await trx('public_pages')
        .where({ id: item.row.id, account_id: item.row.account_id })
        .update({ draft_document: item.draft, published_document: item.published });
    }
    await trx.raw(`ALTER TABLE public_pages
      ADD CONSTRAINT public_pages_draft_document_schema_v8_check
        CHECK (draft_document @> '{"schemaVersion":8}'::jsonb),
      ADD CONSTRAINT public_pages_published_document_schema_v8_check
        CHECK (published_document IS NULL OR published_document @> '{"schemaVersion":8}'::jsonb)`);
  });
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('Public Page schema v8 migration is forward-only');
}
