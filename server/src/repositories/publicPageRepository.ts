import type { Knex } from 'knex';
import { z } from 'zod';
import type { PublicPageDocument, PublishIssue } from '../config/publicPageSchemas.js';
import { db } from '../db/knex.js';
import { publicPageMediaUrl } from '../utils/publicPageMediaUrl.js';
import { publicPageBlocks } from '../utils/publicPageReferences.js';

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
      | 'PAGE_NOT_ARCHIVED'
      | 'MISSING_SERVICES'
      | 'INVALID_MEDIA',
    public readonly current?: PublicPageRecord,
    public readonly missingServiceIds?: number[],
    public readonly issues?: PublishIssue[],
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
  const otherColumn = column === 'draft_page_id' ? 'published_page_id' : 'draft_page_id';
  await trx('public_page_slug_claims').where(column, pageId).whereNot({ slug: keepSlug })
    .whereNull(otherColumn).delete();
  await trx('public_page_slug_claims').where(column, pageId).whereNot({ slug: keepSlug }).update({
    [column]: null,
    updated_at: trx.fn.now(),
  });
}

function scopedPage(trx: Knex | Knex.Transaction, accountId: number, pageId: string) {
  return trx<PublicPageRecord>('public_pages').where({ account_id: accountId, id: pageId });
}

async function lockAccount(trx: Knex.Transaction, accountId: number): Promise<void> {
  await trx('accounts').where({ id: accountId }).forUpdate().first('id');
}

async function revalidateServiceReferences(
  trx: Knex.Transaction,
  accountId: number,
  document: PublicPageDocument,
): Promise<void> {
  const serviceIds = [...new Set(publicPageBlocks(document)
    .filter((block) => block.type === 'services')
    .flatMap((block) => block.content.serviceIds))];
  if (serviceIds.length === 0) return;

  const rows = await trx('services').where({ account_id: accountId }).whereIn('id', serviceIds)
    .select<{ id: number }[]>('id');
  const ownedIds = new Set(rows.map(({ id }) => id));
  const missingServiceIds = serviceIds.filter((id) => !ownedIds.has(id));
  if (missingServiceIds.length > 0) {
    throw new PublicPageRepositoryError('MISSING_SERVICES', undefined, missingServiceIds);
  }
}

async function validateMediaReferences(
  trx: Knex.Transaction,
  accountId: number,
  document: PublicPageDocument,
): Promise<void> {
  if (document.media.length === 0) return;
  const validIds = document.media.map(({ id }) => id).filter((id) => z.string().uuid().safeParse(id).success);
  const rows = await trx('public_page_media').where({ account_id: accountId })
    .whereIn('id', validIds).select<{ id: string }[]>('id');
  const ownedIds = new Set(rows.map(({ id }) => id));
  const issues = document.media.flatMap((media, index): PublishIssue[] => {
    if (!ownedIds.has(media.id)) return [{ code: 'missing_media', path: `media.${index}.id` }];
    if (media.url !== publicPageMediaUrl(media.id)) return [{ code: 'invalid_media', path: `media.${index}.url` }];
    return [];
  });
  if (issues.length > 0) throw new PublicPageRepositoryError('INVALID_MEDIA', undefined, undefined, issues);
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

export async function isPublicPageSlugAvailable(slug: string, pageId?: string): Promise<boolean> {
  const claim = await db('public_page_slug_claims').where({ slug }).first<{
    draft_page_id: string | null;
    published_page_id: string | null;
  }>();
  if (!claim) return true;
  if (!pageId) return false;
  return [claim.draft_page_id, claim.published_page_id]
    .every((claimedPageId) => claimedPageId === null || claimedPageId === pageId);
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
    await lockAccount(trx, input.accountId);
    const existing = await trx<PublicPageRecord>('public_pages').where({ id: input.document.id }).first();
    if (existing) throw new PublicPageRepositoryError('SLUG_CONFLICT');
    const count = await trx('public_pages').where({ account_id: input.accountId })
      .whereNot({ status: 'archived' }).count<{ count: string }[]>('* as count').first();
    if (Number(count?.count ?? 0) >= input.quota) throw new PublicPageRepositoryError('QUOTA_EXCEEDED');
    await revalidateServiceReferences(trx, input.accountId, input.document);
    await validateMediaReferences(trx, input.accountId, input.document);
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
    await lockAccount(trx, input.accountId);
    const page = await scopedPage(trx, input.accountId, input.pageId).forUpdate().first();
    if (!page || page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== input.expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    await revalidateServiceReferences(trx, input.accountId, input.document);
    await validateMediaReferences(trx, input.accountId, input.document);
    await releaseOtherSlugClaims(trx, input.pageId, input.document.slug, 'draft_page_id');
    await claimSlug(trx, input.pageId, input.document.slug, 'draft_page_id');
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
    await lockAccount(trx, accountId);
    const page = await scopedPage(trx, accountId, pageId).forUpdate().first();
    if (!page || page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    if (page.draft_document.archivedBlocks.length > 0) {
      await revalidateServiceReferences(trx, accountId, page.draft_document);
      await validateMediaReferences(trx, accountId, page.draft_document);
    }
    await revalidateServiceReferences(trx, accountId, publishedDocument);
    await validateMediaReferences(trx, accountId, publishedDocument);
    await releaseOtherSlugClaims(trx, pageId, publishedDocument.slug, 'published_page_id');
    await claimSlug(trx, pageId, publishedDocument.slug, 'published_page_id');
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

export async function restorePublicPage(
  accountId: number,
  pageId: string,
  expectedRevision: number,
  quota: number,
): Promise<PublicPageRecord> {
  return db.transaction(async (trx) => {
    await lockAccount(trx, accountId);
    const page = await scopedPage(trx, accountId, pageId).forUpdate().first();
    if (!page) throw new PublicPageRepositoryError('NOT_FOUND');
    if (page.revision !== expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
    if (page.status !== 'archived') throw new PublicPageRepositoryError('PAGE_NOT_ARCHIVED');
    const count = await trx('public_pages').where({ account_id: accountId })
      .whereNot({ status: 'archived' }).count<{ count: string }[]>('* as count').first();
    if (Number(count?.count ?? 0) >= quota) throw new PublicPageRepositoryError('QUOTA_EXCEEDED');
    const restoredDocument = {
      ...page.draft_document,
      status: 'draft' as const,
      updatedAt: new Date().toISOString(),
    };
    await claimSlug(trx, pageId, restoredDocument.slug, 'draft_page_id');
    await scopedPage(trx, accountId, pageId).update({
      status: 'draft',
      draft_document: restoredDocument,
      published_document: null,
      archived_at: null,
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
