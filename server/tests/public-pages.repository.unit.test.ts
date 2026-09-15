import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validPublicPageDocument } from './publicPageTestFixture.js';
import { publicPageMediaUrl } from '../src/utils/publicPageMediaUrl.js';

const insertedPages = vi.hoisted(() => [] as Record<string, unknown>[]);
const slugClaim = vi.hoisted(() => ({
  value: undefined as { draft_page_id: string | null; published_page_id: string | null } | undefined,
}));
type SlugClaim = { draft_page_id: string | null; published_page_id: string | null };
const storedClaims = vi.hoisted(() => ({ value: null as Map<string, SlugClaim> | null }));
const repositoryState = vi.hoisted(() => ({
  accountExists: true,
  page: undefined as Record<string, unknown> | undefined,
  activeCount: 0,
  serviceIds: [] as number[],
  media: [] as { id: string; account_id: number }[],
  events: [] as string[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock('../src/db/knex.js', () => {
  const makeBuilder = (table: string) => {
    let isCount = false;
    const filters: Record<string, unknown> = {};
    const excluded: Record<string, unknown> = {};
    const matchesClaim = (slug: string, claim: SlugClaim) => {
      const row: Record<string, unknown> = { slug, ...claim };
      return Object.entries(filters).every(([key, value]) => row[key] === value)
        && Object.entries(excluded).every(([key, value]) => row[key] !== value);
    };
    const writeClaim = (slug: string, claim: SlugClaim) => {
      if (claim.draft_page_id === null && claim.published_page_id === null) {
        throw Object.assign(new Error('empty claim'), { code: '23514' });
      }
      for (const [existingSlug, existing] of storedClaims.value ?? []) {
        if (existingSlug !== slug && (['draft_page_id', 'published_page_id'] as const)
          .some((column) => claim[column] !== null && existing[column] === claim[column])) {
          throw Object.assign(new Error('duplicate page claim'), { code: '23505' });
        }
      }
      storedClaims.value?.set(slug, {
        draft_page_id: claim.draft_page_id,
        published_page_id: claim.published_page_id,
      });
    };
    let whereInValues: unknown[] = [];
    const builder = {
      where: vi.fn((columnOrValues: string | Record<string, unknown>, value?: unknown) => {
        if (typeof columnOrValues === 'string') filters[columnOrValues] = value;
        else Object.assign(filters, columnOrValues);
        return builder;
      }),
      whereNull: vi.fn((column: string) => {
        filters[column] = null;
        return builder;
      }),
      whereIn: vi.fn((_column: string, values: unknown[]) => {
        whereInValues = values;
        return builder;
      }),
      whereNot: vi.fn((values: Record<string, unknown>) => {
        Object.assign(excluded, values);
        repositoryState.events.push(`${table}:whereNot:${JSON.stringify(values)}`);
        return builder;
      }),
      forUpdate: vi.fn(() => {
        repositoryState.events.push(`${table}:forUpdate`);
        return builder;
      }),
      count: vi.fn(function () {
        isCount = true;
        return builder;
      }),
      select: vi.fn(async () => {
        repositoryState.events.push(`${table}:select`);
        if (table === 'services') {
          return repositoryState.serviceIds.filter((id) => whereInValues.includes(id)).map((id) => ({ id }));
        }
        if (table === 'public_page_media') {
          return repositoryState.media.filter((row) => row.account_id === filters.account_id
            && whereInValues.includes(row.id)).map(({ id }) => ({ id }));
        }
        return [];
      }),
      first: vi.fn(async () => {
        if (table === 'accounts') return repositoryState.accountExists ? { id: filters.id } : undefined;
        if (table === 'public_page_slug_claims') return storedClaims.value
          ? storedClaims.value.get(String(filters.slug)) : slugClaim.value;
        if (table === 'public_pages' && isCount) return { count: String(repositoryState.activeCount) };
        if (table === 'public_pages' && repositoryState.page) {
          const matchesId = filters.id === undefined || repositoryState.page.id === filters.id;
          const matchesAccount = filters.account_id === undefined
            || repositoryState.page.account_id === filters.account_id;
          if (matchesId && matchesAccount) return repositoryState.page;
        }
        return undefined;
      }),
      insert: vi.fn(async (value: Record<string, unknown>) => {
        repositoryState.events.push(`${table}:insert`);
        if (table === 'public_pages') {
          insertedPages.push(value);
          repositoryState.page = {
            ...value,
            published_document: null,
            published_at: null,
            archived_at: null,
          };
        }
        if (table === 'public_page_slug_claims') {
          const claim = {
            draft_page_id: typeof value.draft_page_id === 'string' ? value.draft_page_id : null,
            published_page_id: typeof value.published_page_id === 'string' ? value.published_page_id : null,
          };
          if (storedClaims.value) {
            if (storedClaims.value.has(String(value.slug))) {
              throw Object.assign(new Error('duplicate slug'), { code: '23505' });
            }
            writeClaim(String(value.slug), claim);
          } else slugClaim.value = claim;
        }
      }),
      update: vi.fn(async (value: Record<string, unknown>) => {
        repositoryState.events.push(`${table}:update`);
        repositoryState.updates.push(value);
        if (table === 'public_page_slug_claims' && storedClaims.value) {
          for (const [slug, claim] of storedClaims.value) {
            if (matchesClaim(slug, claim)) writeClaim(slug, { ...claim, ...value });
          }
        }
        if (table === 'public_pages' && repositoryState.page) {
          repositoryState.page = { ...repositoryState.page, ...value };
        }
        return 1;
      }),
      delete: vi.fn(async () => {
        if (table === 'public_page_slug_claims' && storedClaims.value) {
          for (const [slug, claim] of storedClaims.value) {
            if (matchesClaim(slug, claim)) storedClaims.value.delete(slug);
          }
        }
        return 0;
      }),
    };
    return builder;
  };
  const trx = Object.assign((table: string) => makeBuilder(table), { fn: { now: () => new Date() } });
  return {
    db: Object.assign(vi.fn((table: string) => makeBuilder(table)), {
      transaction: vi.fn(async (callback: (trxValue: typeof trx) => unknown) => {
        const claimsBefore = storedClaims.value && new Map(storedClaims.value);
        const pageBefore = repositoryState.page;
        try {
          return await callback(trx);
        } catch (error) {
          storedClaims.value = claimsBefore;
          repositoryState.page = pageBefore;
          throw error;
        }
      }),
    }),
  };
});

import {
  createPublicPage,
  isPublicPageSlugAvailable,
  publishPublicPage,
  restorePublicPage,
  savePublicPageDraft,
} from '../src/repositories/publicPageRepository.js';

describe('public page repository', () => {
  beforeEach(() => {
    insertedPages.length = 0;
    slugClaim.value = undefined;
    storedClaims.value = null;
    repositoryState.accountExists = true;
    repositoryState.page = undefined;
    repositoryState.activeCount = 0;
    repositoryState.serviceIds = [];
    repositoryState.media = [];
    repositoryState.events.length = 0;
    repositoryState.updates.length = 0;
  });

  it('creates a page for the token account at revision one', async () => {
    const result = await createPublicPage({
      accountId: 7,
      document: validPublicPageDocument,
      quota: 10,
    });
    expect(insertedPages).toHaveLength(1);
    expect(insertedPages[0]).toMatchObject({ id: 'page-1', account_id: 7, revision: 1 });
    expect(result.id).toBe('page-1');
  });

  const withServices = (serviceIds: number[]) => ({
    ...validPublicPageDocument,
    sections: [{
      ...validPublicPageDocument.sections[0],
      blocks: [{
        ...validPublicPageDocument.sections[0]!.blocks[0],
        type: 'services' as const,
        content: { title: 'Services', serviceIds, autoplayIntervalSeconds: null, showBookingButton: true },
      }],
    }],
  });

  it('locks the account and revalidates service references before creating a page', async () => {
    repositoryState.serviceIds = [7];
    await createPublicPage({ accountId: 7, document: withServices([7]), quota: 10 });

    expect(repositoryState.events.indexOf('accounts:forUpdate')).toBeLessThan(
      repositoryState.events.indexOf('services:select'),
    );
    expect(repositoryState.events.indexOf('services:select')).toBeLessThan(
      repositoryState.events.indexOf('public_pages:insert'),
    );
  });

  it('rejects a service deleted after outer validation before creating a page', async () => {
    await expect(createPublicPage({ accountId: 7, document: withServices([7]), quota: 10 }))
      .rejects.toMatchObject({ code: 'MISSING_SERVICES', missingServiceIds: [7] });
    expect(insertedPages).toHaveLength(0);
  });

  it('validates service ownership inside archived blocks before saving', async () => {
    repositoryState.page = archivedRecord({ status: 'draft', archived_at: null });
    const serviceBlock = withServices([77]).sections[0]!.blocks[0]!;
    const document = { ...validPublicPageDocument, archivedBlocks: [{ sourceSectionId: 'removed-section', block: {
      ...serviceBlock, id: 'archived-service',
    } }] };
    await expect(savePublicPageDraft({ accountId: 7, pageId: 'page-1', document, expectedRevision: 4 }))
      .rejects.toMatchObject({ code: 'MISSING_SERVICES', missingServiceIds: [77] });
    expect(repositoryState.updates).toHaveLength(0);
  });

  const archivedRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'page-1',
    account_id: 7,
    status: 'archived',
    draft_document: { ...validPublicPageDocument, status: 'archived' },
    published_document: null,
    revision: 4,
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T01:00:00.000Z',
    published_at: '2026-07-28T00:30:00.000Z',
    archived_at: '2026-07-28T01:00:00.000Z',
    ...overrides,
  });

  it('uses account then page locks and revalidates before saving a draft', async () => {
    repositoryState.page = archivedRecord({
      status: 'draft', revision: 4, draft_document: withServices([7]), archived_at: null,
    });
    repositoryState.serviceIds = [7];

    await savePublicPageDraft({
      accountId: 7, pageId: 'page-1', document: withServices([7]), expectedRevision: 4,
    });

    expect(repositoryState.events.filter((event) => event.endsWith(':forUpdate')).slice(0, 2)).toEqual([
      'accounts:forUpdate', 'public_pages:forUpdate',
    ]);
    expect(repositoryState.events.indexOf('services:select')).toBeLessThan(
      repositoryState.events.lastIndexOf('public_pages:update'),
    );
  });

  it('changes a draft slug while keeping the previous published address until publishing', async () => {
    const oldSlug = validPublicPageDocument.slug;
    const nextDocument = { ...validPublicPageDocument, slug: 'new-address' };
    repositoryState.page = archivedRecord({ status: 'published', archived_at: null });
    storedClaims.value = new Map([[oldSlug, { draft_page_id: 'page-1', published_page_id: 'page-1' }]]);

    await expect(isPublicPageSlugAvailable(nextDocument.slug, 'page-1')).resolves.toBe(true);
    const saved = await savePublicPageDraft({
      accountId: 7, pageId: 'page-1', document: nextDocument, expectedRevision: 4,
    });
    expect(saved.draft_document.slug).toBe('new-address');
    expect(storedClaims.value.get(oldSlug)).toEqual({ draft_page_id: null, published_page_id: 'page-1' });
    expect(storedClaims.value.get('new-address')).toEqual({ draft_page_id: 'page-1', published_page_id: null });

    await publishPublicPage(7, 'page-1', 5, nextDocument);
    expect(storedClaims.value.has(oldSlug)).toBe(false);
    expect(storedClaims.value.get('new-address')).toEqual({ draft_page_id: 'page-1', published_page_id: 'page-1' });
  });

  it('changes an unpublished address without creating an empty claim', async () => {
    repositoryState.page = archivedRecord({ status: 'draft', archived_at: null });
    storedClaims.value = new Map([[validPublicPageDocument.slug, { draft_page_id: 'page-1', published_page_id: null }]]);
    await savePublicPageDraft({
      accountId: 7, pageId: 'page-1', document: { ...validPublicPageDocument, slug: 'new-address' }, expectedRevision: 4,
    });
    expect(storedClaims.value.size).toBe(1);
    expect(storedClaims.value.get('new-address')).toEqual({ draft_page_id: 'page-1', published_page_id: null });
  });

  it.each(['create', 'save', 'publish'] as const)('rejects foreign, missing and noncanonical media during %s', async (operation) => {
    const id = '36ed7e97-d733-4a11-80ad-8b06d3d1526d';
    const document = { ...validPublicPageDocument, media: [{
      id, url: publicPageMediaUrl(id), mimeType: 'image/png' as const, alt: 'Photo', width: 1, height: 1,
    }] };
    const run = () => operation === 'create'
      ? createPublicPage({ accountId: 7, document, quota: 10 })
      : operation === 'save'
        ? savePublicPageDraft({ accountId: 7, pageId: 'page-1', document, expectedRevision: 4 })
        : publishPublicPage(7, 'page-1', 4, document);
    if (operation !== 'create') repositoryState.page = archivedRecord({ status: 'draft', archived_at: null });
    for (const media of [[], [{ id, account_id: 8 }]]) {
      repositoryState.media = media;
      await expect(run()).rejects.toMatchObject({ code: 'INVALID_MEDIA', issues: [{ code: 'missing_media', path: 'media.0.id' }] });
    }
    repositoryState.media = [{ id, account_id: 7 }];
    document.media[0]!.url = 'https://external.invalid/image.png';
    await expect(run()).rejects.toMatchObject({ code: 'INVALID_MEDIA', issues: [{ code: 'invalid_media', path: 'media.0.url' }] });
    expect(repositoryState.updates).toHaveLength(0);
    document.media[0]!.url = publicPageMediaUrl(id);
    await expect(run()).resolves.toMatchObject({ id: 'page-1' });
  });

  it.each(['draft', 'published'] as const)('rolls back the old %s claim when another page owns the requested address', async (kind) => {
    const oldSlug = validPublicPageDocument.slug;
    repositoryState.page = archivedRecord({ status: 'published', archived_at: null });
    const originalClaims = new Map<string, SlugClaim>([
      [oldSlug, { draft_page_id: 'page-1', published_page_id: 'page-1' }],
      ['taken-address', { draft_page_id: 'other-page', published_page_id: null }],
    ]);
    storedClaims.value = new Map(originalClaims);
    const nextDocument = { ...validPublicPageDocument, slug: 'taken-address' };
    const operation = kind === 'draft'
      ? savePublicPageDraft({ accountId: 7, pageId: 'page-1', document: nextDocument, expectedRevision: 4 })
      : publishPublicPage(7, 'page-1', 4, nextDocument);

    await expect(operation).rejects.toMatchObject({ code: 'SLUG_CONFLICT' });
    expect(storedClaims.value).toEqual(originalClaims);
    expect(repositoryState.page?.revision).toBe(4);
  });

  it('uses account then page locks and revalidates before publishing', async () => {
    repositoryState.page = archivedRecord({
      status: 'draft', revision: 4, draft_document: withServices([7]), archived_at: null,
    });
    repositoryState.serviceIds = [7];

    await publishPublicPage(7, 'page-1', 4, withServices([7]));

    expect(repositoryState.events.filter((event) => event.endsWith(':forUpdate')).slice(0, 2)).toEqual([
      'accounts:forUpdate', 'public_pages:forUpdate',
    ]);
    expect(repositoryState.events.indexOf('services:select')).toBeLessThan(
      repositoryState.events.lastIndexOf('public_pages:update'),
    );
  });

  it('restores an account-scoped archived page as a draft and reclaims its slug', async () => {
    repositoryState.page = archivedRecord();

    const result = await restorePublicPage(7, 'page-1', 4, 10);

    expect(repositoryState.events.filter((event) => event.endsWith(':forUpdate')).slice(0, 2)).toEqual([
      'accounts:forUpdate',
      'public_pages:forUpdate',
    ]);
    expect(repositoryState.events).toContain('public_pages:whereNot:{"status":"archived"}');
    expect(slugClaim.value).toEqual({ draft_page_id: 'page-1', published_page_id: null });
    expect(repositoryState.updates.at(-1)).toMatchObject({
      status: 'draft',
      draft_document: expect.objectContaining({
        status: 'draft',
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      }),
      published_document: null,
      archived_at: null,
      revision: 5,
    });
    expect(result).toMatchObject({
      status: 'draft',
      draft_document: expect.objectContaining({ status: 'draft' }),
      published_document: null,
      revision: 5,
      published_at: '2026-07-28T00:30:00.000Z',
      archived_at: null,
    });
  });

  it('does not restore a page belonging to another account', async () => {
    repositoryState.page = archivedRecord({ account_id: 8 });

    await expect(restorePublicPage(7, 'page-1', 4, 10)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repositoryState.updates).toHaveLength(0);
  });

  it('reports a revision conflict before checking archived status', async () => {
    repositoryState.page = archivedRecord({ status: 'draft', revision: 5 });

    await expect(restorePublicPage(7, 'page-1', 4, 10)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
      current: expect.objectContaining({ revision: 5, status: 'draft' }),
    });
  });

  it('rejects restoring a current non-archived revision', async () => {
    repositoryState.page = archivedRecord({ status: 'draft' });

    await expect(restorePublicPage(7, 'page-1', 4, 10))
      .rejects.toMatchObject({ code: 'PAGE_NOT_ARCHIVED' });
  });

  it('enforces the shared active page quota when restoring', async () => {
    repositoryState.page = archivedRecord();
    repositoryState.activeCount = 10;

    await expect(restorePublicPage(7, 'page-1', 4, 10))
      .rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    expect(slugClaim.value).toBeUndefined();
    expect(repositoryState.updates).toHaveLength(0);
  });

  it('keeps the page archived when its draft slug was claimed by another page', async () => {
    repositoryState.page = archivedRecord();
    slugClaim.value = { draft_page_id: 'other-page', published_page_id: null };

    await expect(restorePublicPage(7, 'page-1', 4, 10))
      .rejects.toMatchObject({ code: 'SLUG_CONFLICT' });
    expect(repositoryState.updates).toHaveLength(0);
  });

  it.each([
    ['an unclaimed slug', undefined, undefined, true],
    ['a foreign draft claim', { draft_page_id: 'other', published_page_id: null }, 'page-1', false],
    ['a foreign published claim', { draft_page_id: null, published_page_id: 'other' }, 'page-1', false],
    ['its own draft claim', { draft_page_id: 'page-1', published_page_id: null }, 'page-1', true],
    ['its own published claim', { draft_page_id: null, published_page_id: 'page-1' }, 'page-1', true],
    ['its own draft and published claims', { draft_page_id: 'page-1', published_page_id: 'page-1' }, 'page-1', true],
    ['mixed own and foreign claims', { draft_page_id: 'page-1', published_page_id: 'other' }, 'page-1', false],
    ['a claimed slug without a current page', { draft_page_id: 'page-1', published_page_id: null }, undefined, false],
  ])('reports %s availability', async (_label, claim, pageId, expected) => {
    slugClaim.value = claim as typeof slugClaim.value;
    await expect(isPublicPageSlugAvailable('valid-page', pageId as string | undefined)).resolves.toBe(expected);
  });
});
