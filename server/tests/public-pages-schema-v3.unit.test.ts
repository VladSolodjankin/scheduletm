import { describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import { publicPageDocumentSchema } from '../src/config/publicPageSchemas.js';
import { convertPublicPageDocumentToSchemaV3, down, up } from '../src/db/migrations/20260910160000_migrate_public_pages_to_schema_v3.js';
import { convertPublicPageDocumentToSchemaV4 } from '../src/db/migrations/20260910180000_migrate_public_pages_to_schema_v4.js';
import { publicSnapshotWithoutArchive } from '../src/utils/publicPageReferences.js';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const withSchedule = (schedule: unknown) => ({ ...validPublicPageDocument, sections: [{
  ...validPublicPageDocument.sections[0], blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], schedule }],
}] });

describe('public page v3 contract', () => {
  it.each([
    { period: null, weekdays: null },
    { period: { startAt: '2026-10-01T00:00:00Z', endAt: '2026-11-01T00:00:00Z' }, weekdays: [1, 7] },
  ])('accepts disabled or explicit UTC schedules', (schedule) => {
    expect(publicPageDocumentSchema.safeParse(withSchedule(schedule)).success).toBe(true);
  });
  it.each([
    { period: null, weekdays: [] }, { period: null, weekdays: [1, 1] }, { period: null, weekdays: [0] },
    { period: null, weekdays: [8] },
    { period: { startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-01T00:00:00Z' }, weekdays: null },
    { period: { startAt: '2026-10-01T00:00:00+04:00', endAt: '2026-11-01T00:00:00Z' }, weekdays: null },
  ])('rejects invalid schedules', (schedule) => {
    expect(publicPageDocumentSchema.safeParse(withSchedule(schedule)).success).toBe(false);
  });
  it('requires a valid page timezone and IDs unique across active and archived blocks', () => {
    expect(publicPageDocumentSchema.safeParse({ ...validPublicPageDocument, timezone: 'Invalid/Timezone' }).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse({ ...validPublicPageDocument, archivedBlocks: [{
      block: validPublicPageDocument.sections[0]!.blocks[0], sourceSectionId: 'section-1',
    }] }).success).toBe(false);
  });
  it('rejects archive references missing from the document media manifest', () => {
    expect(publicPageDocumentSchema.safeParse({ ...validPublicPageDocument, archivedBlocks: [{ sourceSectionId: 'removed', block: {
      ...validPublicPageDocument.sections[0]!.blocks[0], id: 'archive-image', type: 'image', content: { imageMediaId: 'missing', alt: 'Photo' },
    } }] }).success).toBe(false);
  });
  it('strips archived content and archive-only media but retains shared media and scheduled blocks', () => {
    const source = publicPageDocumentSchema.parse({ ...validPublicPageDocument,
      profile: { ...validPublicPageDocument.profile, logoMediaId: 'shared' },
      media: ['archive-only', 'shared'].map((id) => ({ id, url: `https://example.org/${id}`, mimeType: 'image/png', alt: id, width: 1, height: 1 })),
      archivedBlocks: [{ sourceSectionId: 'removed-section', block: {
        ...validPublicPageDocument.sections[0]!.blocks[0], id: 'archived', type: 'gallery',
        content: { images: [{ mediaId: 'archive-only', alt: 'Private' }, { mediaId: 'shared', alt: 'Shared' }] },
      } }],
    });
    const result = publicSnapshotWithoutArchive(source);
    expect(result.archivedBlocks).toEqual([]);
    expect(result.media.map(({ id }) => id)).toEqual(['shared']);
    expect(result.sections).toEqual(source.sections);
    expect(source.archivedBlocks).toHaveLength(1);
    expect(source.media).toHaveLength(2);
  });
  it('converts v2 without changing IDs, media or numeric font units; moves active button colors only', () => {
    const { timezone: _timezone, archivedBlocks: _archive, ...base } = validPublicPageDocument;
    const { avatarPosition: _avatarPosition, ...profile } = base.profile;
    const originalBlock = validPublicPageDocument.sections[0]!.blocks[0]!;
    const { linkStyle: _link, animation: _animation, ...design } = originalBlock.design;
    const { schedule: _schedule, ...block } = originalBlock;
    const v2 = { ...base, profile, schemaVersion: 2, sections: [{ ...base.sections[0], blocks: [{
      ...block, design, type: 'button', content: { label: 'Go', icon: 'link', color: '#ff0000', textColor: '#ffffff', radius: 99,
        action: { type: 'url', url: 'https://example.org' } },
    }] }] };
    const result = convertPublicPageDocumentToSchemaV3(v2, 'Europe/Samara');
    expect(publicPageDocumentSchema.safeParse(convertPublicPageDocumentToSchemaV4(result)).success).toBe(true);
    expect(result.timezone).toBe('Europe/Samara');
    expect(result.media).toEqual(v2.media);
    expect(result.theme).toEqual(v2.theme);
    expect(result.sections[0]!.blocks[0]).toMatchObject({ id: block.id, schedule: { period: null, weekdays: null },
      content: { label: 'Go', subtitle: '', openInNewTab: true }, design: { borderRadius: null,
        linkStyle: { backgroundColor: '#ff0000', backgroundOpacity: 1, titleStyle: { color: '#ffffff' } } } });
    expect(result.sections[0]!.blocks[0]!.content).not.toHaveProperty('radius');
    expect(() => convertPublicPageDocumentToSchemaV3(v2, 'Invalid/Zone')).toThrow();
    expect(() => convertPublicPageDocumentToSchemaV3({ ...v2, schemaVersion: 99 }, 'UTC')).toThrow();
    for (const [roundingStyle, radius] of [['square', 2], ['pill', 40]] as const) {
      const rounded = convertPublicPageDocumentToSchemaV3({ ...v2, theme: { ...v2.theme, roundingStyle } }, 'UTC');
      expect(rounded.theme.tokens.layout.linkRadius).toBe(radius);
      expect(rounded.theme.styleDefaults.sectionBorderRadius).toBe(radius);
      expect(rounded.theme.styleDefaults.blockBorderRadius).toBe(radius);
      expect(rounded.sections[0]!.blocks[0]!.design.borderRadius).toBe(null);
    }
  });
  it('refuses a destructive down migration', async () => {
    await expect(down({} as Knex)).rejects.toThrow('forward-only');
  });

  it('migrates draft and published independently, preserves null publication and touches no record metadata', async () => {
    const { timezone: _zone, archivedBlocks: _archive, ...base } = validPublicPageDocument;
    const { avatarPosition: _avatarPosition, ...profile } = base.profile;
    const v2 = { ...base, profile, schemaVersion: 2, sections: base.sections.map((section) => ({ ...section,
      blocks: section.blocks.map(({ schedule: _schedule, design: { linkStyle: _link, animation: _animation, ...design }, ...block }) => ({ ...block, design })),
    })) };
    const rows = [
      { id: 'page-1', account_id: 7, timezone: 'Europe/Samara', draft_document: v2, published_document: { ...v2, slug: 'old-published-slug' } },
      { id: 'page-2', account_id: 8, timezone: null, draft_document: { ...v2, id: 'page-2' }, published_document: null },
    ];
    const update = vi.fn().mockResolvedValue(1);
    const where = vi.fn().mockReturnValue({ update });
    const raw = vi.fn().mockResolvedValue(undefined);
    const trx = Object.assign(vi.fn((table: string) => table === 'public_pages as p'
      ? { leftJoin: () => ({ select: () => ({ forUpdate: async () => rows }) }) } : { where }), { raw });
    const knex = { transaction: async (callback: (transaction: typeof trx) => unknown) => callback(trx) } as unknown as Knex;
    await up(knex);
    expect(where).toHaveBeenNthCalledWith(1, { id: 'page-1', account_id: 7 });
    expect(update.mock.calls[0]![0]).toMatchObject({ draft_document: { slug: v2.slug, timezone: 'Europe/Samara' },
      published_document: { slug: 'old-published-slug', timezone: 'Europe/Samara' } });
    expect(update.mock.calls[1]![0]).toMatchObject({ draft_document: { timezone: 'UTC' }, published_document: null });
    expect(Object.keys(update.mock.calls[0]![0]).sort()).toEqual(['draft_document', 'published_document']);
    expect(raw.mock.calls[0]![0]).toContain('DROP CONSTRAINT public_pages_draft_document_schema_v2_check');
    expect(raw.mock.calls[1]![0]).toContain('public_pages_published_document_schema_v3_check');
  });
});
