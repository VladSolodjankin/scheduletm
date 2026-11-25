import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { publicPageDocumentSchema } from '@meetli/shared/public-page';
import { convertPublicPageDocumentToSchemaV7 } from '../src/db/migrations/20261118090000_migrate_public_pages_to_schema_v7.js';
import { convertPublicPageDocumentToSchemaV6 } from '../src/db/migrations/20261110090000_migrate_public_pages_to_schema_v6.js';
import {
  convertPublicPageDocumentToSchemaV8,
  down,
  publicPageLocaleFromAccountLocale,
  up,
} from '../src/db/migrations/20261119090000_migrate_public_pages_to_schema_v8.js';
import { validPublicPageDocument, validSchemaV5Document } from './publicPageTestFixture.js';

const schemaV7Document = () => convertPublicPageDocumentToSchemaV7(convertPublicPageDocumentToSchemaV6(validSchemaV5Document));

describe('Public Page schema v8 migration', () => {
  it('maps the account locale to a supported page language', () => {
    expect(publicPageLocaleFromAccountLocale('en-US')).toBe('en');
    expect(publicPageLocaleFromAccountLocale('EN')).toBe('en');
    expect(publicPageLocaleFromAccountLocale('ru-RU')).toBe('ru');
    expect(publicPageLocaleFromAccountLocale('de-DE')).toBe('ru');
    expect(publicPageLocaleFromAccountLocale(null)).toBe('ru');
  });

  it('adds the locale and keeps everything else', () => {
    const source = schemaV7Document();
    const result = convertPublicPageDocumentToSchemaV8(source, 'en-GB');
    expect(result.schemaVersion).toBe(8);
    expect(result.locale).toBe('en');
    expect(result.sections).toEqual(source.sections);
    expect(publicPageDocumentSchema.safeParse(result).success).toBe(true);
  });

  it('rejects non-v7 input', () => {
    expect(() => convertPublicPageDocumentToSchemaV8(validPublicPageDocument, 'ru-RU')).toThrow();
  });

  it('migrates draft and published snapshots in one transaction and is forward-only', async () => {
    const update = vi.fn().mockResolvedValue(1);
    const rows = [{ id: 'page-1', account_id: 1, account_locale: 'en-US', draft_document: schemaV7Document(), published_document: null }];
    const query = {
      leftJoin: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
      forUpdate: vi.fn().mockResolvedValue(rows), where: vi.fn().mockReturnThis(), update,
    };
    const raw = vi.fn().mockResolvedValue(undefined);
    const trx = Object.assign(vi.fn(() => query), { raw });
    const knex = { transaction: vi.fn(async (callback: (value: unknown) => Promise<void>) => callback(trx)) } as unknown as Knex;

    await up(knex);

    expect(update.mock.calls[0]![0].draft_document.locale).toBe('en');
    expect(update.mock.calls[0]![0].published_document).toBeNull();
    expect(raw.mock.calls.flat().join(' ')).toContain('schemaVersion":8');
    await expect(down(knex)).rejects.toThrow('forward-only');
  });
});
