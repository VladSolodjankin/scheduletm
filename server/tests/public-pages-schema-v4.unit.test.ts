import { readFileSync } from 'node:fs';
import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { publicPageDocumentSchema } from '../src/config/publicPageSchemas.js';
import {
  convertPublicPageDocumentToSchemaV4,
  down,
  up,
} from '../src/db/migrations/20260910180000_migrate_public_pages_to_schema_v4.js';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const schemaV3Document = () => {
  const { avatarPosition: _avatarPosition, ...profile } = validPublicPageDocument.profile;
  return { ...validPublicPageDocument, schemaVersion: 3, profile };
};

describe('Public Page schema v4 migration', () => {
  it('adds the centered avatar position without changing other document data', () => {
    const source = schemaV3Document();
    const result = convertPublicPageDocumentToSchemaV4(source);

    expect(publicPageDocumentSchema.safeParse(result).success).toBe(true);
    expect(result).toEqual({
      ...source,
      schemaVersion: 4,
      profile: { ...source.profile, avatarPosition: '50% 50%' },
    });
  });

  it('rejects non-v3 input and unexpected source profile fields', () => {
    const source = schemaV3Document();
    expect(() => convertPublicPageDocumentToSchemaV4({ ...source, schemaVersion: 2 })).toThrow();
    expect(() => convertPublicPageDocumentToSchemaV4({
      ...source,
      profile: { ...source.profile, avatarPosition: '25% 75%' },
    })).toThrow();
  });

  it('pins the migration schemas locally without runtime schema imports', () => {
    const source = readFileSync(new URL(
      '../src/db/migrations/20260910180000_migrate_public_pages_to_schema_v4.ts',
      import.meta.url,
    ), 'utf8');
    expect(source).not.toContain("from '../../config/publicPageSchemas.js'");
    expect(source).toContain("from './20260910160000_migrate_public_pages_to_schema_v3.js'");
    expect(source).toContain('MIGRATION_SOURCE_PUBLIC_PAGE_SCHEMA_VERSION = 3 as const');
    expect(source).toContain('MIGRATION_TARGET_PUBLIC_PAGE_SCHEMA_VERSION = 4 as const');
  });

  it('migrates draft and published independently and preserves null publication', async () => {
    const v3 = schemaV3Document();
    const rows = [
      {
        id: 'page-1', account_id: 7, draft_document: v3,
        published_document: { ...v3, slug: 'published-page' },
      },
      {
        id: 'page-2', account_id: 8,
        draft_document: { ...v3, id: 'page-2' }, published_document: null,
      },
    ];
    const update = vi.fn().mockResolvedValue(1);
    const where = vi.fn().mockReturnValue({ update });
    const raw = vi.fn().mockResolvedValue(undefined);
    const trx = Object.assign(vi.fn((table: string) => table === 'public_pages as p'
      ? { select: () => ({ forUpdate: async () => rows }) }
      : { where }), { raw });
    const knex = {
      transaction: async (callback: (transaction: typeof trx) => unknown) => callback(trx),
    } as unknown as Knex;

    await up(knex);

    expect(where).toHaveBeenNthCalledWith(1, { id: 'page-1', account_id: 7 });
    expect(where).toHaveBeenNthCalledWith(2, { id: 'page-2', account_id: 8 });
    expect(update.mock.calls[0]![0]).toMatchObject({
      draft_document: { profile: { avatarPosition: '50% 50%' } },
      published_document: { slug: 'published-page', profile: { avatarPosition: '50% 50%' } },
    });
    expect(update.mock.calls[1]![0]).toMatchObject({
      draft_document: { profile: { avatarPosition: '50% 50%' } },
      published_document: null,
    });
    expect(Object.keys(update.mock.calls[0]![0]).sort()).toEqual([
      'draft_document', 'published_document',
    ]);
    expect(raw.mock.calls[0]![0]).toContain('public_pages_draft_document_schema_v3_check');
    expect(raw.mock.calls[1]![0]).toContain('public_pages_published_document_schema_v4_check');
  });

  it('refuses a destructive down migration', async () => {
    await expect(down({} as Knex)).rejects.toThrow('forward-only');
  });

  it('rejects malformed unchanged v3 data before DDL or updates and rolls back', async () => {
    const v3 = schemaV3Document();
    const malformed = {
      ...v3,
      theme: {
        ...v3.theme,
        colors: { ...v3.theme.colors, background: '' },
      },
    };
    const rows = [{
      id: 'page-bad', account_id: 9,
      draft_document: malformed, published_document: null,
    }];
    const update = vi.fn().mockResolvedValue(1);
    const where = vi.fn().mockReturnValue({ update });
    const raw = vi.fn().mockResolvedValue(undefined);
    const trx = Object.assign(vi.fn((table: string) => table === 'public_pages as p'
      ? { select: () => ({ forUpdate: async () => rows }) }
      : { where }), { raw });
    let rolledBack = false;
    const knex = {
      transaction: async (callback: (transaction: typeof trx) => unknown) => {
        try {
          return await callback(trx);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    } as unknown as Knex;

    await expect(up(knex)).rejects.toThrow('Public Page page-bad draft_document');
    expect(rolledBack).toBe(true);
    expect(raw).not.toHaveBeenCalled();
    expect(where).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
