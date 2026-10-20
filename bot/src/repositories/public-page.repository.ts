import { db } from '../db/knex';

/** Slug of the earliest published public page of an active account, or null when there is none. */
export async function findFirstPublishedPublicPageSlug(): Promise<string | null> {
  const row = await db('public_page_slug_claims as claims')
    .join('public_pages as pages', 'pages.id', 'claims.published_page_id')
    .join('accounts', 'accounts.id', 'pages.account_id')
    .where('pages.status', 'published')
    .whereNull('pages.archived_at')
    .whereNotNull('pages.published_document')
    .where('accounts.is_active', true)
    .orderBy('pages.published_at', 'asc')
    .first<{ slug: string }>('claims.slug as slug');

  return row?.slug ?? null;
}
