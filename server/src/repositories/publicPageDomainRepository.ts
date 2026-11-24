import { db } from '../db/knex.js';
import type { PublicPageRecord } from './publicPageRepository.js';

export type PublicPageDomainRecord = { domain: string; verified_at: Date | string | null };

/** The domain of one of the account's pages; null when the page has none (or is not the account's). */
export async function findPublicPageDomain(accountId: number, pageId: string): Promise<PublicPageDomainRecord | null> {
  return (await db<PublicPageDomainRecord>('public_page_domains as domains')
    .join('public_pages as pages', 'pages.id', 'domains.page_id')
    .where({ 'pages.id': pageId, 'pages.account_id': accountId })
    .select('domains.domain', 'domains.verified_at')
    .first()) ?? null;
}

/** Gives the page this domain, replacing its previous one. Throws a unique violation when another page owns it. */
export async function replacePublicPageDomain(pageId: string, domain: string): Promise<void> {
  await db.transaction(async (trx) => {
    await trx('public_page_domains').where({ page_id: pageId }).del();
    await trx('public_page_domains').insert({ domain, page_id: pageId });
  });
}

export async function markPublicPageDomainVerified(pageId: string): Promise<void> {
  await db('public_page_domains').where({ page_id: pageId }).update({ verified_at: db.fn.now() });
}

export async function deletePublicPageDomain(pageId: string): Promise<void> {
  await db('public_page_domains').where({ page_id: pageId }).del();
}

/** The published page that is served from this verified domain. */
export async function findPublishedPublicPageByDomain(domain: string): Promise<PublicPageRecord | null> {
  return (await db<PublicPageRecord>('public_page_domains as domains')
    .join('public_pages as pages', 'pages.id', 'domains.page_id')
    .join('accounts', 'accounts.id', 'pages.account_id')
    .where('domains.domain', domain)
    .whereNotNull('domains.verified_at')
    .where('pages.status', 'published')
    .whereNull('pages.archived_at')
    .whereNotNull('pages.published_document')
    .where('accounts.is_active', true)
    .select('pages.*')
    .first()) ?? null;
}
