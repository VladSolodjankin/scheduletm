import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Knex } from 'knex';
import {
  convertPublicPageDocumentToSchemaV2,
  convertPublicPageSnapshotsToSchemaV2,
  down,
  PublicPageSchemaV2MigrationError,
  up,
} from '../src/db/migrations/20260826120000_migrate_public_pages_to_schema_v2.js';
import { publicPageDocumentSchema } from '../src/config/publicPageSchemas.js';
import { convertPublicPageDocumentToSchemaV3 } from '../src/db/migrations/20260910160000_migrate_public_pages_to_schema_v3.js';
import { convertPublicPageDocumentToSchemaV4 } from '../src/db/migrations/20260910180000_migrate_public_pages_to_schema_v4.js';

const design = { backgroundColor: null, textColor: null };
const block = (id: string, type: string, content: Record<string, unknown>) => ({
  id, type, name: type, visible: true, content, design,
});
const v1Document = (blocks: Array<ReturnType<typeof block>>, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  id: 'page-1',
  slug: 'valid-page',
  status: 'draft',
  profile: { displayName: 'Name', description: '', logoMediaId: null, avatarMediaId: null },
  theme: {
    id: 'minimal', name: 'Minimal',
    colors: { background: '#fff', surface: '#fff', text: '#111', primary: '#00f' },
  },
  sections: [{
    id: 'section-1', name: '', visible: true, layout: 'single', blocks,
    design: { variant: 'custom' },
  }],
  seo: { title: 'Title', description: 'Description', imageMediaId: null },
  media: [],
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
  ...overrides,
});
const context = (snapshot: 'draft_document' | 'published_document' = 'draft_document') => ({
  pageId: 'page-1', accountId: 9, snapshot, ownedServiceIds: new Set([7, 9]),
});

describe('Public Page schema v2 migration', () => {
  it('drops removed blocks and converts v1 avatar, contacts, text, and verified services deterministically', () => {
    const input = v1Document([
      block('hero-1', 'hero', {
        title: 'Specialist', subtitle: 'About', imageUrl: '',
        imageAlt: 'Specialist', ctaLabel: 'Visit', action: { type: 'url', url: 'https://example.com' },
      }),
      block('avatar-1', 'avatar', {
        heading: 'Name', subtitle: '', imageMediaId: 'media-1', imageUrl: '/old.svg', imageAlt: 'Name',
        layout: 'compact', coverMediaId: 'media-2', coverUrl: '/cover.svg',
      }),
      block('contacts-1', 'contacts', {
        title: 'Contacts', contacts: [
          { id: 'email', label: 'Email', url: 'mailto:hello@example.com' },
          { id: 'phone', label: 'Phone', url: 'tel:+15551234567' },
          { id: 'web', label: 'Website', url: 'https://example.com' },
        ],
      }),
      block('text-1', 'text', { title: 'About', body: 'First line\nSecond line' }),
      block('services-1', 'services', {
        title: 'Services', services: [{ id: 7, title: 'Consultation', price: '100' }],
      }),
      block('services-2', 'services', {
        title: 'Services', serviceIds: [7], autoplayIntervalSeconds: null, showBookingButton: true,
      }),
    ], { media: [
      { id: 'media-1', url: 'https://cdn.example.com/avatar.webp', mimeType: 'image/webp', alt: '', width: 1, height: 1 },
      { id: 'media-2', url: 'https://cdn.example.com/cover.webp', mimeType: 'image/webp', alt: '', width: 1, height: 1 },
    ] });

    const result = convertPublicPageDocumentToSchemaV2(input, context());

    expect(result.wasAlreadyV2).toBe(false);
    expect(result.document.schemaVersion).toBe(2);
    expect(result.document.sections[0]!.blocks.map(({ id, type }) => ({ id, type }))).toEqual([
      { id: 'avatar-1', type: 'avatar' },
      { id: 'contacts-1', type: 'contacts' },
      { id: 'text-1', type: 'text' },
      { id: 'services-2', type: 'services' },
    ]);
    expect(result.document.sections[0]!.blocks[0]!.content).toMatchObject({
      layout: 'cover-centered', avatarSize: 65, imageMediaId: 'media-1', coverMediaId: 'media-2',
    });
    expect(result.document.sections[0]!.blocks[1]!.content).toMatchObject({
      contacts: [
        { id: 'email', label: 'Email', action: { type: 'email', email: 'hello@example.com' } },
        { id: 'phone', label: 'Phone', action: { type: 'phone', phone: '+15551234567' } },
        { id: 'web', label: 'Website', action: { type: 'url', url: 'https://example.com' } },
      ],
    });
    expect(result.document.sections[0]!.blocks[3]!.content).toEqual({
      title: 'Services', serviceIds: [7], autoplayIntervalSeconds: null, showBookingButton: true,
    });
    expect(publicPageDocumentSchema.safeParse(
      convertPublicPageDocumentToSchemaV4(convertPublicPageDocumentToSchemaV3(result.document, 'UTC')),
    ).success).toBe(true);
  });

  it('strips fallback URLs when managed media IDs are present', () => {
    const result = convertPublicPageDocumentToSchemaV2(v1Document([
      block('image-managed', 'image', {
        imageMediaId: 'media-1', url: 'https://example.com/image.jpg', alt: 'Managed',
      }),
      block('gallery-1', 'gallery', { images: [
        { mediaId: 'media-1', url: 'https://example.com/fallback.jpg', alt: 'Managed' },
      ] }),
    ], {
      media: [{
        id: 'media-1', url: 'https://cdn.example.com/image.webp', mimeType: 'image/webp',
        alt: 'Managed', width: 320, height: 240,
      }],
    }), context());

    expect(result.document.sections[0]!.blocks).toHaveLength(2);
    expect(result.document.sections[0]!.blocks[0]!.content).toEqual({
      imageMediaId: 'media-1', alt: 'Managed',
    });
    expect(result.document.sections[0]!.blocks[1]!.content).toEqual({
      images: [{ mediaId: 'media-1', alt: 'Managed' }],
    });
  });

  it('drops legacy media URLs unconditionally without losing supported blocks', () => {
    const result = convertPublicPageDocumentToSchemaV2(v1Document([
      block('avatar-1', 'avatar', {
        heading: 'Name', subtitle: '', imageMediaId: null, imageUrl: '/avatar.jpg', imageAlt: '',
        layout: 'centered', avatarSize: 150, coverMediaId: null, coverUrl: 123,
      }),
      block('image-1', 'image', { imageMediaId: null, url: 'https://example.com/a.jpg', alt: '' }),
      block('gallery-1', 'gallery', { images: [{ id: 'old-1', mediaId: null, url: 123, alt: '' }] }),
    ]), context());

    expect(result.document.sections[0]!.blocks.map((item) => item.type)).toEqual([
      'avatar', 'image', 'gallery',
    ]);
    expect(result.document.sections[0]!.blocks[0]!.content).toMatchObject({
      imageMediaId: null, coverMediaId: null,
    });
    expect(result.document.sections[0]!.blocks[1]!.content).toEqual({ imageMediaId: null, alt: '' });
    expect(result.document.sections[0]!.blocks[2]!.content).toEqual({ images: [] });
  });

  it('keeps valid managed media IDs and clears stale references', () => {
    const result = convertPublicPageDocumentToSchemaV2(v1Document([
      block('avatar-1', 'avatar', {
        heading: 'Name', subtitle: '', imageMediaId: 'media-1', imageAlt: '', layout: 'centered',
        avatarSize: 150, coverMediaId: 'missing-cover',
      }),
      block('image-1', 'image', { imageMediaId: 'missing-image', alt: '' }),
      block('gallery-1', 'gallery', { images: [
        { mediaId: 'media-1', alt: 'Valid' },
        { mediaId: 'missing-gallery', alt: 'Stale' },
      ] }),
    ], { media: [{
      id: 'media-1', url: 'https://cdn.example.com/image.webp', mimeType: 'image/webp',
      alt: '', width: 1, height: 1,
    }] }), context());

    expect(result.document.sections[0]!.blocks[0]!.content).toMatchObject({
      imageMediaId: 'media-1', coverMediaId: null,
    });
    expect(result.document.sections[0]!.blocks[1]!.content).toEqual({ imageMediaId: null, alt: '' });
    expect(result.document.sections[0]!.blocks[2]!.content).toEqual({
      images: [{ mediaId: 'media-1', alt: 'Valid' }],
    });
  });

  it('clears stale media IDs from profile, theme, SEO, section design, and block design', () => {
    const textBlock = block('text-1', 'text', { title: 'About', body: 'Text' });
    textBlock.design = { ...design, backgroundMediaId: 'missing-block' };
    const input = v1Document([textBlock], { media: [{
      id: 'media-1', url: 'https://cdn.example.com/image.webp', mimeType: 'image/webp',
      alt: '', width: 1, height: 1,
    }] });
    input.profile = {
      displayName: 'Name', description: '', logoMediaId: 'missing-logo', avatarMediaId: 'media-1',
    };
    input.theme = { ...input.theme, backgroundMediaId: 'missing-theme' };
    input.seo = { title: 'Title', description: 'Description', imageMediaId: 'missing-seo' };
    input.sections[0]!.design = { variant: 'custom', backgroundMediaId: 'missing-section' };

    const result = convertPublicPageDocumentToSchemaV2(input, context());

    expect(result.document.profile).toMatchObject({ logoMediaId: null, avatarMediaId: 'media-1' });
    expect(result.document.theme.backgroundMediaId).toBeNull();
    expect(result.document.seo.imageMediaId).toBeNull();
    expect(result.document.sections[0]!.design.backgroundMediaId).toBeNull();
    expect(result.document.sections[0]!.blocks[0]!.design.backgroundMediaId).toBeNull();
  });

  it('reports malformed source media before converting blocks', () => {
    expect(() => convertPublicPageDocumentToSchemaV2(v1Document([
      block('image-1', 'image', {
        imageMediaId: 'media-1', url: 'https://example.com/image.jpg', alt: '',
      }),
    ], { media: [{ id: 'media-1', url: 123 }] }), context())).toThrow(expect.objectContaining({
      pageId: 'page-1', snapshot: 'draft_document', path: 'media.0.url',
    } satisfies Partial<PublicPageSchemaV2MigrationError>));
  });

  it('drops legacy, invalid, duplicated, and non-owned services blocks', () => {
    const result = convertPublicPageDocumentToSchemaV2(v1Document([
      block('legacy', 'services', { title: 'Legacy', services: [{ id: 7 }] }),
      block('invalid', 'services', { title: 'Invalid', serviceIds: ['7'] }),
      block('duplicated', 'services', { title: 'Duplicated', serviceIds: [7, 7] }),
      block('foreign', 'services', { title: 'Foreign', serviceIds: [999] }),
    ]), context());

    expect(result.document.sections[0]!.blocks).toEqual([]);
  });

  it('drops removed and unknown block types before parsing their content', () => {
    const result = convertPublicPageDocumentToSchemaV2(v1Document([
      { id: 'hero-1', type: 'hero', name: 'hero', visible: true, content: null, design } as never,
      { id: 'booking-1', type: 'booking', name: 'booking', visible: true, content: 7, design } as never,
      { id: 'unknown-1', type: 'future-block', name: 'unknown', visible: true, design } as never,
    ]), context());

    expect(result.document.sections[0]!.blocks).toEqual([]);
  });

  it.each([
    ['unsafe contact URL', v1Document([block('contacts-1', 'contacts', {
      title: 'Contacts', contacts: [{ id: 'bad', label: 'Bad', url: 'javascript:alert(1)' }],
    })]), 'sections.0.blocks.0.content.contacts.0.url'],
    ['ambiguous contact fields', v1Document([block('contacts-1', 'contacts', {
      title: 'Contacts', contacts: [{
        id: 'bad', label: 'Bad', url: 'https://example.com',
        action: { type: 'url', url: 'https://example.com' },
      }],
    })]), 'sections.0.blocks.0.content.contacts.0'],
    ['ambiguous text', v1Document([block('text-1', 'text', {
      title: 'Legacy', document: { type: 'rich-text-v1', paragraphs: [] },
    })]), 'sections.0.blocks.0.content'],
  ])('aborts the document for %s with page, snapshot, and path', (_name, input, path) => {
    expect(() => convertPublicPageDocumentToSchemaV2(input, context())).toThrow(expect.objectContaining({
      pageId: 'page-1', snapshot: 'draft_document', path,
    } satisfies Partial<PublicPageSchemaV2MigrationError>));
  });

  it('transforms draft and published snapshots independently', () => {
    const converted = convertPublicPageSnapshotsToSchemaV2({
      id: 'page-1', account_id: 9,
      draft_document: v1Document([block('image-1', 'image', { imageMediaId: null, url: '', alt: 'A' })]),
      published_document: v1Document([block('text-1', 'text', { title: 'Published', body: 'Copy' })], {
        status: 'published',
      }),
    }, new Set([7]));

    expect(converted.draftDocument.schemaVersion).toBe(2);
    expect(converted.publishedDocument?.schemaVersion).toBe(2);
    expect(converted.publishedDocument?.status).toBe('published');
  });

  it.each([
    ['draft_document', 'draft_document'],
    ['published_document', 'published_document'],
  ] as const)('reports the exact %s snapshot for malformed supported content', (field, snapshot) => {
    const safe = v1Document([block('text-1', 'text', { title: '', body: '' })]);
    const unsafe = v1Document([block('text-1', 'text', {
      title: 'Legacy', document: { type: 'rich-text-v1', paragraphs: [] },
    })]);
    expect(() => convertPublicPageSnapshotsToSchemaV2({
      id: 'page-1', account_id: 9,
      draft_document: field === 'draft_document' ? unsafe : safe,
      published_document: field === 'published_document' ? unsafe : safe,
    }, new Set())).toThrow(expect.objectContaining({
      pageId: 'page-1', snapshot, path: 'sections.0.blocks.0.content',
    } satisfies Partial<PublicPageSchemaV2MigrationError>));
  });

  it('normalizes blank required theme strings and rebuilds invalid swatches', () => {
    const input = v1Document([block('text-1', 'text', { title: '', body: '' })]);
    const theme = input.theme as Record<string, unknown>;
    theme.colors = { background: '', surface: '', text: '', primary: '' };
    theme.fontFamily = '';
    theme.swatches = ['', '#123456', '', '#abcdef'];
    theme.tokens = {
      colors: {
        contrast: '', linkTitle: '', linkSubtitle: '', linkShadow: '', linkBorder: '',
        focus: '', checkboxBackground: '',
      },
      typography: {
        fontFamily: '', headingColor: '',
        avatarTitle: { fontFamily: '' }, linkTitle: { fontFamily: '' },
      },
    };
    theme.styleDefaults = {
      headingStyle: { fontFamily: '', color: '' },
      textStyle: { fontFamily: '', color: '' },
      linkStyle: {
        titleStyle: { fontFamily: '', color: '' },
        subtitleStyle: { fontFamily: '', color: '' },
        backgroundColor: '', borderColor: '',
      },
    };

    const result = convertPublicPageDocumentToSchemaV2(input, context());

    expect(result.document.theme.colors).toEqual({
      background: '#ffffff', surface: '#ffffff', text: '#111827', primary: '#2563eb',
    });
    expect(result.document.theme.swatches).toEqual(['#ffffff', '#2563eb', '#ffffff', '#111827']);
    expect(result.document.theme.fontFamily).toBe('Inter, system-ui, sans-serif');
    expect(result.document.theme.tokens.typography.avatarTitle.fontFamily).toBe('Inter, system-ui, sans-serif');
    expect(result.document.theme.styleDefaults.linkStyle).toMatchObject({
      backgroundColor: '#ffffff', borderColor: 'transparent',
      titleStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: '#111827' },
    });
    expect(publicPageDocumentSchema.safeParse(
      convertPublicPageDocumentToSchemaV4(convertPublicPageDocumentToSchemaV3(result.document, 'UTC')),
    ).success).toBe(true);
  });

  it('is idempotent for a valid v2 document', () => {
    const first = convertPublicPageDocumentToSchemaV2(v1Document([
      block('text-1', 'text', { title: 'Title', body: 'Body' }),
    ]), context());
    const second = convertPublicPageDocumentToSchemaV2(first.document, context());

    expect(second.wasAlreadyV2).toBe(true);
    expect(second.document).toEqual(first.document);
  });

  it('sanitizes all stale media references in an already-v2 document', () => {
    const first = convertPublicPageDocumentToSchemaV2(v1Document([
      block('avatar-1', 'avatar', {
        heading: 'Name', subtitle: '', imageMediaId: 'media-1', imageAlt: '', layout: 'centered',
        avatarSize: 150, coverMediaId: 'media-1',
      }),
      block('image-1', 'image', { imageMediaId: 'media-1', alt: '' }),
      block('gallery-1', 'gallery', { images: [{ mediaId: 'media-1', alt: '' }] }),
    ], { media: [{
      id: 'media-1', url: 'https://cdn.example.com/image.webp', mimeType: 'image/webp',
      alt: '', width: 1, height: 1,
    }] }), context());
    const stale = structuredClone(first.document);
    stale.profile.logoMediaId = 'missing-logo';
    stale.profile.avatarMediaId = 'missing-profile-avatar';
    stale.theme.backgroundMediaId = 'missing-theme';
    stale.seo.imageMediaId = 'missing-seo';
    stale.sections[0]!.design.backgroundMediaId = 'missing-section';
    stale.sections[0]!.blocks.forEach((item) => { item.design.backgroundMediaId = 'missing-block'; });
    const avatar = stale.sections[0]!.blocks[0]!;
    if (avatar.type === 'avatar') {
      avatar.content.imageMediaId = 'missing-avatar';
      avatar.content.coverMediaId = 'missing-cover';
    }
    const image = stale.sections[0]!.blocks[1]!;
    if (image.type === 'image') image.content.imageMediaId = 'missing-image';
    const gallery = stale.sections[0]!.blocks[2]!;
    if (gallery.type === 'gallery') gallery.content.images.push({ mediaId: 'missing-gallery', alt: '' });

    const result = convertPublicPageDocumentToSchemaV2(stale, context());

    expect(result.wasAlreadyV2).toBe(true);
    expect(result.document.profile).toMatchObject({ logoMediaId: null, avatarMediaId: null });
    expect(result.document.theme.backgroundMediaId).toBeNull();
    expect(result.document.seo.imageMediaId).toBeNull();
    expect(result.document.sections[0]!.design.backgroundMediaId).toBeNull();
    expect(result.document.sections[0]!.blocks.every((item) => item.design.backgroundMediaId === null)).toBe(true);
    expect(result.document.sections[0]!.blocks[0]!.content).toMatchObject({
      imageMediaId: null, coverMediaId: null,
    });
    expect(result.document.sections[0]!.blocks[1]!.content).toMatchObject({ imageMediaId: null });
    expect(result.document.sections[0]!.blocks[2]!.content).toEqual({
      images: [{ mediaId: 'media-1', alt: '' }],
    });
  });

  it('pins schema v2 locally without importing mutable runtime schema exports', () => {
    const source = readFileSync(new URL(
      '../src/db/migrations/20260826120000_migrate_public_pages_to_schema_v2.ts',
      import.meta.url,
    ), 'utf8');
    expect(source).not.toContain("from '../../config/publicPageSchemas.js'");
    expect(source).not.toMatch(/\bPUBLIC_PAGE_SCHEMA_VERSION\b/);
    expect(source).not.toMatch(/\bpublicPageDocumentSchema\b/);
    expect(source).toContain('MIGRATION_PUBLIC_PAGE_SCHEMA_VERSION = 2 as const');
  });

  it('migrates legacy media URLs transactionally', async () => {
    const events: string[] = [];
    const updates: unknown[] = [];
    const rows = [{
      id: 'page-legacy', account_id: 9,
      draft_document: v1Document([block('avatar-1', 'avatar', {
        heading: 'Name', subtitle: '', imageMediaId: null,
        imageUrl: '/public-page-placeholders/link-in-bio.svg', imageAlt: '',
        layout: 'centered', avatarSize: 150, coverMediaId: null,
      })], { id: 'page-legacy' }),
      published_document: null,
    }];
    const trx = ((table: string) => {
      if (table === 'services') {
        return { where: () => ({ select: async () => [] }) };
      }
      return {
        select: () => ({ forUpdate: async () => rows }),
        where: () => ({ update: async (payload: unknown) => { events.push('update'); updates.push(payload); } }),
      };
    }) as unknown as Knex.Transaction;
    (trx as unknown as { raw: () => Promise<void> }).raw = async () => { events.push('constraint'); };
    const knex = {
      transaction: async (callback: (value: Knex.Transaction) => Promise<void>) => callback(trx),
    } as unknown as Knex;

    await expect(up(knex)).resolves.toBeUndefined();
    expect(events).toEqual(['update', 'constraint', 'constraint']);
    expect(JSON.stringify(updates)).not.toContain('imageUrl');
  });

  it('converts every locked row before writing when supported content is malformed', async () => {
    const events: string[] = [];
    const rows = [{
      id: 'page-safe', account_id: 9,
      draft_document: v1Document([block('text-1', 'text', { title: 'Safe', body: '' })], { id: 'page-safe' }),
      published_document: null,
    }, {
      id: 'page-malformed', account_id: 9,
      draft_document: v1Document([block('text-1', 'text', {
        title: 'Legacy', document: { type: 'rich-text-v1', paragraphs: [] },
      })], { id: 'page-malformed' }),
      published_document: null,
    }];
    const trx = ((table: string) => {
      if (table === 'services') {
        return { where: () => ({ select: async () => [] }) };
      }
      return {
        select: () => ({ forUpdate: async () => rows }),
        where: () => ({ update: async () => { events.push('update'); } }),
      };
    }) as unknown as Knex.Transaction;
    (trx as unknown as { raw: () => Promise<void> }).raw = async () => { events.push('constraint'); };
    const knex = {
      transaction: async (callback: (value: Knex.Transaction) => Promise<void>) => callback(trx),
    } as unknown as Knex;

    await expect(up(knex)).rejects.toMatchObject({
      pageId: 'page-malformed', snapshot: 'draft_document', path: 'sections.0.blocks.0.content',
    });
    expect(events).toEqual([]);
  });

  it('is explicitly forward-only', async () => {
    await expect(down({} as never)).rejects.toThrow('forward-only');
  });
});
