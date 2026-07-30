import { describe, expect, it, vi } from 'vitest';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const insertedPages = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('../src/db/knex.js', () => {
  const makeBuilder = (table: string) => {
    let isCount = false;
    const builder = {
      where: vi.fn().mockReturnThis(),
      whereNull: vi.fn().mockReturnThis(),
      whereNot: vi.fn().mockReturnThis(),
      forUpdate: vi.fn().mockReturnThis(),
      count: vi.fn(function () {
        isCount = true;
        return builder;
      }),
      first: vi.fn(async () => {
        if (table === 'accounts') return { id: 7 };
        if (table === 'public_pages' && isCount) return { count: '0' };
        if (table === 'public_pages' && insertedPages.length > 0) {
          return {
            id: 'page-1',
            account_id: 7,
            draft_document: validPublicPageDocument,
            published_document: null,
            revision: 1,
            archived_at: null,
          };
        }
        return undefined;
      }),
      insert: vi.fn(async (value: Record<string, unknown>) => {
        if (table === 'public_pages') insertedPages.push(value);
      }),
      update: vi.fn(async () => 1),
      delete: vi.fn(async () => 0),
    };
    return builder;
  };
  const trx = Object.assign((table: string) => makeBuilder(table), { fn: { now: () => new Date() } });
  return {
    db: Object.assign(vi.fn(), {
      transaction: vi.fn(async (callback: (trxValue: typeof trx) => unknown) => callback(trx)),
    }),
  };
});

import { createPublicPage } from '../src/repositories/publicPageRepository.js';

describe('public page repository', () => {
  it('creates a page for the token account at revision one', async () => {
    insertedPages.length = 0;
    const result = await createPublicPage({
      accountId: 7,
      document: validPublicPageDocument,
      quota: 10,
    });
    expect(insertedPages).toHaveLength(1);
    expect(insertedPages[0]).toMatchObject({ id: 'page-1', account_id: 7, revision: 1 });
    expect(result.id).toBe('page-1');
  });
});
