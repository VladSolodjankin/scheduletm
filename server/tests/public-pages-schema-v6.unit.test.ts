import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { publicPageDocumentSchema } from '@scheduletm/shared/public-page';
import { convertPublicPageDocumentToSchemaV6, down, up } from '../src/db/migrations/20261110090000_migrate_public_pages_to_schema_v6.js';
import { convertPublicPageDocumentToSchemaV7 } from '../src/db/migrations/20261118090000_migrate_public_pages_to_schema_v7.js';
import { convertPublicPageDocumentToSchemaV8 } from '../src/db/migrations/20261119090000_migrate_public_pages_to_schema_v8.js';
import { validPublicPageDocument, validSchemaV5Document } from './publicPageTestFixture.js';

type Layout = 'single' | 'two-equal' | 'one-third-two-thirds' | 'two-thirds-one-third' | 'three-equal' | 'stack' | 'hero-overlay';

const schemaV5Document = (layout: Layout = 'single') => ({
  ...validSchemaV5Document,
  sections: [{ ...validSchemaV5Document.sections[0], layout }],
});

describe('Public Page schema v6 migration', () => {
  it('replaces section layout with sizes and adds the new defaults', () => {
    const result = convertPublicPageDocumentToSchemaV6(schemaV5Document());
    expect(publicPageDocumentSchema.safeParse(convertPublicPageDocumentToSchemaV8(convertPublicPageDocumentToSchemaV7(result), 'ru-RU')).success).toBe(true);
    expect(result.schemaVersion).toBe(6);
    expect(result.theme.pageWidth).toBe('narrow');
    expect(result.theme.styleDefaults.linkStyle).toMatchObject({ width: 'full', align: 'center' });
    expect(result.sections[0]).not.toHaveProperty('layout');
    expect(result.sections[0]).toMatchObject({ size: 'full' });
    expect(result.sections[0].blocks[0]).toMatchObject({ size: 'full' });
    expect(result.sections[0].design.linkStyle).toMatchObject({ width: null, align: null });
  });

  it.each(['two-equal', 'one-third-two-thirds', 'two-thirds-one-third', 'three-equal'] as const)(
    'turns the %s section layout into half-width blocks',
    (layout) => {
      const result = convertPublicPageDocumentToSchemaV6(schemaV5Document(layout));
      expect(result.sections[0].blocks.every((block) => block.size === 'half')).toBe(true);
      expect(publicPageDocumentSchema.safeParse(convertPublicPageDocumentToSchemaV8(convertPublicPageDocumentToSchemaV7(result), 'ru-RU')).success).toBe(true);
    },
  );

  it.each(['single', 'stack', 'hero-overlay'] as const)('keeps blocks full width for the %s layout', (layout) => {
    const result = convertPublicPageDocumentToSchemaV6(schemaV5Document(layout));
    expect(result.sections[0].blocks.every((block) => block.size === 'full')).toBe(true);
  });

  it('adds the carousel layout to services blocks and null link overrides to styled blocks', () => {
    const source = schemaV5Document();
    const linkStyle = { ...source.sections[0].design.linkStyle, backgroundColor: null };
    const block = {
      ...source.sections[0].blocks[0],
      id: 'services-1',
      type: 'services',
      content: { title: 'Services', serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true },
      design: { ...source.sections[0].blocks[0].design, linkStyle },
    };
    const result = convertPublicPageDocumentToSchemaV6({
      ...source,
      sections: [{ ...source.sections[0], blocks: [block] }],
    });
    expect(result.sections[0].blocks[0].content).toMatchObject({ layout: 'carousel' });
    expect(result.sections[0].blocks[0].design.linkStyle).toMatchObject({ width: null, align: null });
    expect(publicPageDocumentSchema.safeParse(convertPublicPageDocumentToSchemaV8(convertPublicPageDocumentToSchemaV7(result), 'ru-RU')).success).toBe(true);
  });

  it('rejects non-v5 input', () => {
    expect(() => convertPublicPageDocumentToSchemaV6({ ...schemaV5Document(), schemaVersion: 4 })).toThrow();
    expect(() => convertPublicPageDocumentToSchemaV6(validPublicPageDocument)).toThrow();
  });

  it('migrates draft and published snapshots in one transaction and is forward-only', async () => {
    const update = vi.fn().mockResolvedValue(1);
    const rows = [{
      id: 'page-1', account_id: 1,
      draft_document: schemaV5Document('two-equal'),
      published_document: null,
    }];
    const query = { select: vi.fn().mockReturnThis(), forUpdate: vi.fn().mockResolvedValue(rows), where: vi.fn().mockReturnThis(), update };
    const raw = vi.fn().mockResolvedValue(undefined);
    const trx = Object.assign(vi.fn(() => query), { raw });
    const knex = { transaction: vi.fn(async (callback: (value: unknown) => Promise<void>) => callback(trx)) } as unknown as Knex;

    await up(knex);

    expect(raw).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ published_document: null }));
    expect(update.mock.calls[0][0].draft_document.sections[0].blocks[0].size).toBe('half');
    await expect(down(knex)).rejects.toThrow('forward-only');
  });
});
