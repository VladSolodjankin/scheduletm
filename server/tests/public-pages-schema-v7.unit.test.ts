import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { publicPageDocumentSchema } from '@scheduletm/shared/public-page';
import { convertPublicPageDocumentToSchemaV6 } from '../src/db/migrations/20261110090000_migrate_public_pages_to_schema_v6.js';
import { convertPublicPageDocumentToSchemaV7, down, up } from '../src/db/migrations/20261118090000_migrate_public_pages_to_schema_v7.js';
import { convertPublicPageDocumentToSchemaV8 } from '../src/db/migrations/20261119090000_migrate_public_pages_to_schema_v8.js';
import { validPublicPageDocument, validSchemaV5Document } from './publicPageTestFixture.js';

const media = (id: string) => ({ id, url: `https://example.com/${id}.png`, alt: '', mimeType: 'image/png', width: 10, height: 10, sizeBytes: 1 });
const schemaV6Document = () => convertPublicPageDocumentToSchemaV6(validSchemaV5Document);

describe('Public Page schema v7 migration', () => {
  it('removes the profile and keeps everything else', () => {
    const source = schemaV6Document();
    const result = convertPublicPageDocumentToSchemaV7(source);
    expect(result).not.toHaveProperty('profile');
    expect(result.schemaVersion).toBe(7);
    expect(result.sections).toEqual(source.sections);
    expect(result.theme).toEqual(source.theme);
    expect(publicPageDocumentSchema.safeParse(convertPublicPageDocumentToSchemaV8(result, 'ru-RU')).success).toBe(true);
  });

  it('drops media only the profile referenced and keeps media blocks and SEO still use', () => {
    const source = schemaV6Document();
    const withMedia = {
      ...source,
      profile: { ...source.profile, logoMediaId: 'logo', avatarMediaId: 'photo' },
      seo: { ...source.seo, imageMediaId: 'share' },
      media: [media('logo'), media('photo'), media('share')],
    };
    const result = convertPublicPageDocumentToSchemaV7(withMedia);
    expect(result.media.map(({ id }) => id)).toEqual(['share']);
  });

  it('rejects non-v6 input', () => {
    expect(() => convertPublicPageDocumentToSchemaV7({ ...schemaV6Document(), schemaVersion: 5 })).toThrow();
    expect(() => convertPublicPageDocumentToSchemaV7(validPublicPageDocument)).toThrow();
  });

  it('migrates draft and published snapshots in one transaction and is forward-only', async () => {
    const update = vi.fn().mockResolvedValue(1);
    const rows = [{ id: 'page-1', account_id: 1, draft_document: schemaV6Document(), published_document: null }];
    const query = { select: vi.fn().mockReturnThis(), forUpdate: vi.fn().mockResolvedValue(rows), where: vi.fn().mockReturnThis(), update };
    const raw = vi.fn().mockResolvedValue(undefined);
    const trx = Object.assign(vi.fn(() => query), { raw });
    const knex = { transaction: vi.fn(async (callback: (value: unknown) => Promise<void>) => callback(trx)) } as unknown as Knex;

    await up(knex);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ published_document: null }));
    expect(update.mock.calls[0]![0].draft_document).not.toHaveProperty('profile');
    expect(raw.mock.calls.flat().join(' ')).toContain('schemaVersion":7');
    await expect(down(knex)).rejects.toThrow('forward-only');
  });
});
