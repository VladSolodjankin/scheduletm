import { db } from '../db/knex.js';

export type PublicPageMediaRecord = {
  id: string;
  account_id: number;
  object_key: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function createPublicPageMedia(
  record: Omit<PublicPageMediaRecord, 'created_at' | 'updated_at'>,
): Promise<PublicPageMediaRecord> {
  const [created] = await db<PublicPageMediaRecord>('public_page_media')
    .insert({ ...record, created_at: db.fn.now(), updated_at: db.fn.now() })
    .returning('*');
  return created!;
}

export async function findAccountMedia(accountId: number, id: string): Promise<PublicPageMediaRecord | null> {
  return (await db<PublicPageMediaRecord>('public_page_media').where({ account_id: accountId, id }).first()) ?? null;
}

export async function findPublishedMedia(id: string): Promise<PublicPageMediaRecord | null> {
  return (await db<PublicPageMediaRecord>('public_page_media as media')
    .join('accounts', 'accounts.id', 'media.account_id')
    .where('media.id', id)
    .where('accounts.is_active', true)
    .whereExists(function () {
      this.select(db.raw('1')).from('public_pages as pages')
        .whereRaw('pages.account_id = media.account_id')
        .where('pages.status', 'published')
        .whereNull('pages.archived_at')
        .whereNotNull('pages.published_document')
        .whereRaw("exists (select 1 from jsonb_array_elements(coalesce(pages.published_document->'media', '[]'::jsonb)) item where item->>'id' = media.id::text)");
    })
    .select('media.*').first()) ?? null;
}

export async function isMediaReferenced(accountId: number, id: string): Promise<boolean> {
  const row = await db('public_pages').where({ account_id: accountId }).where(function () {
    this.whereRaw("exists (select 1 from jsonb_array_elements(coalesce(draft_document->'media', '[]'::jsonb)) item where item->>'id' = ?)", [id])
      .orWhereRaw("exists (select 1 from jsonb_array_elements(coalesce(published_document->'media', '[]'::jsonb)) item where item->>'id' = ?)", [id]);
  }).first('id');
  return Boolean(row);
}

export async function deleteAccountMedia(accountId: number, id: string): Promise<void> {
  await db('public_page_media').where({ account_id: accountId, id }).delete();
}
