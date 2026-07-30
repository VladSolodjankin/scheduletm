import type { Knex } from 'knex';
import type { PublicPageDocument } from '../config/publicPageSchemas.js';
import { db } from '../db/knex.js';

export type PublicPageStatus = 'draft' | 'published' | 'archived';
export type PublicPageRecord = {
  id: string;
  account_id: number;
  status: PublicPageStatus;
  draft_document: PublicPageDocument;
  published_document: PublicPageDocument | null;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
  archived_at: Date | string | null;
};

export class PublicPageRepositoryError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'REVISION_CONFLICT'
      | 'SLUG_CONFLICT'
      | 'QUOTA_EXCEEDED'
      | 'PAGE_NOT_ARCHIVED',
    public readonly current?: PublicPageRecord,
  ) {
    super(code);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function claimSlug(
  trx: Knex.Transaction,
  pageId: string,
  slug: string,
  column: 'draft_page_id' | 'published_page_id',
): Promise<void> {
  const claim = await trx('public_page_slug_claims').where({ slug }).forUpdate().first<{
    draft_page_id: string | null;
    published_page_id: string | null;
  }>();
  if (claim && [claim.draft_page_id, claim.published_page_id].some((id) => id !== null && id !== pageId)) {
    throw new PublicPageRepositoryError('SLUG_CONFLICT');
  }
  try {
    if (claim) {
      await trx('public_page_slug_claims').where({ slug }).update({ [column]: pageId, updated_at: trx.fn.now() });
    } else {
      await trx('public_page_slug_claims').insert({
        slug,
        [column]: pageId,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw new PublicPageRepositoryError('SLUG_CONFLICT');
    throw error;
  }
}

async function releaseOtherSlugClaims(
  trx: Knex.Transaction,
  pageId: string,
  keepSlug: string,
  column: 'draft_page_id' | 'published_page_id',
): Promise<void> {
  await trx('public_page_slug_claims').where(column, pageId).whereNot({ slug: keepSlug }).update({
    [column]: null,
    updated_at: trx.fn.now(),
  });
  await trx('public_page_slug_claims').whereNull('draft_page_id').whereNull('published_page_id').delete();
}

function scopedPage(trx: Knex | Knex.Transaction, accountId: number, pageId: string) {
  return trx<PublicPageRecord>('public_pages').where({ account_id: accountId, id: pageId });
}

export async function listPublicPages(
  accountId: number,
  status: 'active' | PublicPageStatus | 'all' = 'active',
): Promise<PublicPageRecord[]> {
  const query = db<PublicPageRecord>('public_pages').where({ account_id: accountId });
  if (status === 'active') query.whereNot({ status: 'archived' });
  else if (status !== 'all') query.where({ status });
  return query.orderBy('updated_at', 'desc');
}

export async function findPublicPage(accountId: number, pageId: string): Promise<PublicPageRecord | null> {
  return (await scopedPage(db, accountId, pageId).first()) ?? null;
}

export async function findPublishedPublicPageBySlug(slug: string): Promise<PublicPageRecord | null> {
  return (await db<PublicPageRecord>('public_page_slug_claims as claims')
    .join('public_pages as pages', 'pages.id', 'claims.published_page_id')
    .join('accounts', 'accounts.id', 'pages.account_id')
    .where('claims.slug', slug)
    .where('pages.status', 'published')
    .whereNull('pages.archived_at')
    .whereNotNull('pages.published_document')
    .where('accounts.is_active', true)
    .select('pages.*')
    .first()) ?? null;
}

export async function createPublicPage(input: {
  accountId: number;
  document: PublicPageDocument;
  quota: number;
}): Promise<PublicPageRecord> {
  return db.transaction(async (trx) => {
    await trx('accounts').where({ id: input.accountId }).forUpdate().first('id');
    const existing = await trx<PublicPageRecord>('public_pages').where({ id: input.document.id }).first();
    if (existing) throw new PublicPageRepositoryError('SLUG_CONFLICT');
    const count = await trx('public_pages').where({ account_id: input.accountId })
      .whereNot({ status: 'archived' }).count<{ count: string }[]>('* as count').first();
    if (Number(count?.count ?? 0) >= input.quota) throw new PublicPageRepositoryError('QUOTA_EXCEEDED');
    await trx('public_pages').insert({
      id: input.document.id,
      account_id: input.accountId,
      status: 'draft',
      draft_document: input.document,
      revision: 1,
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
    await claimSlug(trx, input.document.id, input.document.slug, 'draft_page_id');
    return (await scopedPage(trx, input.accountId, input.document.id).first())!;
  });
}

export async function savePublicPageDraft(input: {
  accountId: number;
  pageId: string;
  document: PublicPageDocument;
  expectedRevision: number;
}): Promise<PublicPageRecord> {
  return db.transaction(async (trx) => {
    const page = await scopedPage(trx, input.accountId, input.pageId).forUpdate().first();
    if (!page || page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== input.expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    await claimSlug(trx, input.pageId, input.document.slug, 'draft_page_id');
    await releaseOtherSlugClaims(trx, input.pageId, input.document.slug, 'draft_page_id');
    await scopedPage(trx, input.accountId, input.pageId).update({
      draft_document: input.document,
      revision: page.revision + 1,
      updated_at: trx.fn.now(),
    });
    return (await scopedPage(trx, input.accountId, input.pageId).first())!;
  });
}

export async function publishPublicPage(
  accountId: number,
  pageId: string,
  expectedRevision: number,
  publishedDocument: PublicPageDocument,
): Promise<PublicPageRecord> {
  return db.transaction(async (trx) => {
    const page = await scopedPage(trx, accountId, pageId).forUpdate().first();
    if (!page || page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    await claimSlug(trx, pageId, publishedDocument.slug, 'published_page_id');
    await releaseOtherSlugClaims(trx, pageId, publishedDocument.slug, 'published_page_id');
    await scopedPage(trx, accountId, pageId).update({
      status: 'published',
      published_document: publishedDocument,
      published_at: trx.fn.now(),
      archived_at: null,
      revision: page.revision + 1,
      updated_at: trx.fn.now(),
    });
    return (await scopedPage(trx, accountId, pageId).first())!;
  });
}

export async function archivePublicPage(
  accountId: number,
  pageId: string,
  expectedRevision: number,
): Promise<PublicPageRecord> {
  return db.transaction(async (trx) => {
    const page = await scopedPage(trx, accountId, pageId).forUpdate().first();
    if (!page) throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    if (page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
    const archivedDocument = {
      ...page.draft_document,
      status: 'archived' as const,
      updatedAt: new Date().toISOString(),
    };
    await trx('public_page_slug_claims')
      .where('draft_page_id', pageId).orWhere('published_page_id', pageId).delete();
    await scopedPage(trx, accountId, pageId).update({
      status: 'archived',
      draft_document: archivedDocument,
      published_document: null,
      archived_at: trx.fn.now(),
      revision: page.revision + 1,
      updated_at: trx.fn.now(),
    });
    return (await scopedPage(trx, accountId, pageId).first())!;
  });
}

export async function deletePublicPage(
  accountId: number,
  pageId: string,
  expectedRevision: number,
): Promise<void> {
  await db.transaction(async (trx) => {
    const page = await scopedPage(trx, accountId, pageId).forUpdate().first();
    if (!page) throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    if (page.status !== 'archived') throw new PublicPageRepositoryError('PAGE_NOT_ARCHIVED');
    await scopedPage(trx, accountId, pageId).delete();
  });
}
