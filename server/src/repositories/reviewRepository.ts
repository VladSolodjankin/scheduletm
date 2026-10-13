import { db } from '../db/knex.js';

export type ReviewStatus = 'published' | 'hidden';

export type ReviewRecord = {
  id: number;
  account_id: number;
  name: string;
  text: string;
  rating: number;
  review_date: string;
  screenshot_media_id: string | null;
  screenshot_alt: string;
  status: ReviewStatus;
  source: 'manual' | 'client';
  created_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  screenshot_width: number | null;
  screenshot_height: number | null;
};

export type ReviewWrite = {
  name?: string;
  text?: string;
  rating?: number;
  review_date?: string;
  screenshot_media_id?: string | null;
  screenshot_alt?: string;
  status?: ReviewStatus;
};

const withMedia = (accountId: number) => db('account_reviews as r')
  .leftJoin('public_page_media as m', function joinMedia() {
    this.on('m.id', 'r.screenshot_media_id').andOn('m.account_id', 'r.account_id');
  })
  .where('r.account_id', accountId)
  .select('r.*', 'm.width as screenshot_width', 'm.height as screenshot_height');

export async function listReviews(accountId: number, status?: ReviewStatus): Promise<ReviewRecord[]> {
  const query = withMedia(accountId)
    .orderBy([{ column: 'r.created_at', order: 'desc' }, { column: 'r.id', order: 'desc' }]);
  if (status) query.where('r.status', status);
  return query;
}

export async function findReview(accountId: number, id: number): Promise<ReviewRecord | null> {
  return (await withMedia(accountId).where('r.id', id).first()) ?? null;
}

export async function countReviews(accountId: number): Promise<number> {
  const row = await db('account_reviews').where({ account_id: accountId }).count<{ count: string }>('id as count').first();
  return Number(row?.count ?? 0);
}

export async function createReview(
  accountId: number,
  createdBy: number | null,
  data: Required<ReviewWrite>,
): Promise<number> {
  const [row] = await db('account_reviews')
    .insert({ ...data, account_id: accountId, source: 'manual', created_by: createdBy })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

export async function updateReview(accountId: number, id: number, data: ReviewWrite): Promise<void> {
  await db('account_reviews').where({ account_id: accountId, id }).update({ ...data, updated_at: db.fn.now() });
}

export async function deleteReview(accountId: number, id: number): Promise<boolean> {
  return (await db('account_reviews').where({ account_id: accountId, id }).delete()) > 0;
}
