import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../src/shared/api/client';
import { normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import { PUBLIC_PAGE_SCHEMA_VERSION } from '../../src/features/public-page-builder/types/publicPage';
import { ApiPublicPageRepository } from '../../src/features/public-page-builder/repository/ApiPublicPageRepository';
import { PublicPageRepositoryError } from '../../src/features/public-page-builder/repository/PublicPageRepository';
import { getPublicPageTemplate } from '../../src/features/public-page-builder/templates';

const timestamps = {
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
};

function canonicalDocument(id = 'page/id', slug = 'canonical-page') {
  const document = getPublicPageTemplate('blank')!.createDocument(id, timestamps.createdAt);
  return { ...document, id, slug, updatedAt: timestamps.updatedAt };
}

function apiRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'page/id',
    draft: canonicalDocument(),
    published: null,
    status: 'draft',
    revision: 2,
    ...timestamps,
    ...overrides,
  };
}

function axiosError(data: unknown, status = 409) {
  return new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    {
      data,
      status,
      statusText: 'Request failed',
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );
}

async function expectRepositoryError(
  promise: Promise<unknown>,
  code: PublicPageRepositoryError['code'],
) {
  try {
    await promise;
    throw new Error('expected repository call to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(PublicPageRepositoryError);
    expect((error as PublicPageRepositoryError).code).toBe(code);
    return error as PublicPageRepositoryError;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiPublicPageRepository runtime contract', () => {
  it('saves the exact draft payload with bearer auth and accepts the v2 returned record', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: apiRecord() });
    const repository = new ApiPublicPageRepository('access-token');
    const document = normalizeDocument({ id: 'page/id', slug: 'draft-page' });

    const saved = await repository.saveDraft(document, 1);

    expect(put).toHaveBeenCalledWith(
      '/api/public-pages/page%2Fid/draft',
      { document, expectedRevision: 1 },
      { headers: { Authorization: 'Bearer access-token' } },
    );
    expect(saved).toMatchObject({ id: 'page/id', revision: 2 });
    expect(saved.draft.schemaVersion).toBe(PUBLIC_PAGE_SCHEMA_VERSION);
    expect(saved.draft.profile.displayName).toBe('New page');
  });

  it('publishes with the expected revision and maps the returned server revision', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: apiRecord({ revision: 8, status: 'published', published: canonicalDocument('page/id', 'published-page') }),
    });
    const repository = new ApiPublicPageRepository('access-token');

    const published = await repository.publish('page/id', 7);

    expect(post).toHaveBeenCalledWith(
      '/api/public-pages/page%2Fid/publish',
      { expectedRevision: 7 },
      { headers: { Authorization: 'Bearer access-token' } },
    );
    expect(published.revision).toBe(8);
    expect(published.published).toMatchObject({ slug: 'published-page', schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION });
  });

  it('encodes slug availability parameters and rejects malformed responses', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { slug: 'hello world/é', available: true } })
      .mockResolvedValueOnce({ data: { slug: 42, available: 'yes' } });
    const repository = new ApiPublicPageRepository('access-token');

    await expect(repository.checkSlugAvailability('hello world/é', 'page/id')).resolves.toEqual({
      slug: 'hello world/é', available: true,
    });
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/api/public-pages/slug-availability?slug=hello+world%2F%C3%A9&pageId=page%2Fid',
      { headers: { Authorization: 'Bearer access-token' } },
    );
    await expectRepositoryError(
      repository.checkSlugAvailability('malformed'),
      'storage_unavailable',
    );
  });

  it('loads a canonical public slug anonymously', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: canonicalDocument('public-id', 'public slug') });
    const repository = new ApiPublicPageRepository('');

    const document = await repository.getBySlug('public slug/é');

    expect(get).toHaveBeenCalledWith('/api/public-pages/by-slug/public%20slug%2F%C3%A9');
    expect(document).toMatchObject({
      id: 'public-id', slug: 'public slug', schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION,
    });
  });

  it('keeps a valid revision-conflict current record and ignores a malformed current record', async () => {
    const put = vi.spyOn(apiClient, 'put')
      .mockRejectedValueOnce(axiosError({ code: 'revision_conflict', current: apiRecord({ revision: 5 }) }))
      .mockRejectedValueOnce(axiosError({
        code: 'revision_conflict',
        current: apiRecord({ draft: { schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION + 1 } }),
      }));
    const repository = new ApiPublicPageRepository('token');
    const document = normalizeDocument({ id: 'page/id', slug: 'conflict-page' });

    const valid = await expectRepositoryError(repository.saveDraft(document, 1), 'revision_conflict');
    expect(valid.current).toMatchObject({ revision: 5 });
    expect(valid.current?.draft.schemaVersion).toBe(PUBLIC_PAGE_SCHEMA_VERSION);

    const malformed = await expectRepositoryError(repository.saveDraft(document, 1), 'revision_conflict');
    expect(malformed.current).toBeUndefined();
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('filters malformed publish-validation issues while retaining supported fields', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(axiosError({
      code: 'publish_validation_failed',
      issues: [
        null,
        { code: 'invalid_slug' },
        { code: 123, path: 'slug' },
        { code: 'invalid_slug', path: 'slug', detail: 'reserved', blockId: 123 },
        { code: 'invalid_block', path: 'blocks.hero', blockId: 'hero', sectionId: 'section', detail: 'title required' },
      ],
    }, 422));
    const repository = new ApiPublicPageRepository('token');

    const error = await expectRepositoryError(repository.publish('page', 3), 'publish_validation_failed');

    expect(error.issues).toEqual([
      { code: 'invalid_slug', path: 'slug', detail: 'reserved' },
      {
        code: 'invalid_block', path: 'blocks.hero', blockId: 'hero', sectionId: 'section', detail: 'title required',
      },
    ]);
  });

  it('rejects missing, v1, future, and legacy-shaped documents and preserves non-Axios failures', async () => {
    const malformedDocument = {} as Record<string, unknown>;
    Object.defineProperty(malformedDocument, 'schemaVersion', {
      get() { throw new Error('broken document'); },
    });
    const get = vi.spyOn(apiClient, 'get');
    const original = new Error('programmer failure');
    const repository = new ApiPublicPageRepository('token');

    const missingVersion = canonicalDocument('missing-version', 'missing-version') as Record<string, unknown>;
    delete missingVersion.schemaVersion;
    const legacyContact = getPublicPageTemplate('specialist')!.createDocument('legacy-contact');
    const contactBlock = legacyContact.sections.flatMap((section) => section.blocks)
      .find((block) => block.type === 'contacts')!;
    contactBlock.content = { title: 'Contacts', contacts: [{ id: 'phone', label: 'Phone', url: 'tel:+15551234567' }] };
    get
      .mockResolvedValueOnce({ data: missingVersion })
      .mockResolvedValueOnce({ data: { ...canonicalDocument('v1', 'v1'), schemaVersion: 1 } })
      .mockResolvedValueOnce({ data: { schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION + 1 } })
      .mockResolvedValueOnce({ data: legacyContact })
      .mockResolvedValueOnce({ data: malformedDocument })
      .mockRejectedValueOnce(axiosError({ code: 'unexpected_code' }, 500))
      .mockRejectedValueOnce(original);

    await expectRepositoryError(repository.getBySlug('missing-version'), 'invalid_document');
    await expectRepositoryError(repository.getBySlug('v1'), 'unsupported_version');
    await expectRepositoryError(repository.getBySlug('future'), 'unsupported_version');
    await expectRepositoryError(repository.getBySlug('legacy-contact'), 'invalid_document');
    await expectRepositoryError(repository.getBySlug('malformed'), 'invalid_document');
    await expectRepositoryError(repository.getBySlug('unknown-api-error'), 'storage_unavailable');
    await expect(repository.getBySlug('non-axios')).rejects.toBe(original);
  });
});
