import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const repository = vi.hoisted(() => ({
  listPublicPages: vi.fn(),
  findPublicPage: vi.fn(),
  findPublishedPublicPageBySlug: vi.fn(),
  isPublicPageSlugAvailable: vi.fn(),
  createPublicPage: vi.fn(),
  savePublicPageDraft: vi.fn(),
  publishPublicPage: vi.fn(),
  archivePublicPage: vi.fn(),
  restorePublicPage: vi.fn(),
  deletePublicPage: vi.fn(),
}));
const serviceRepository = vi.hoisted(() => ({ listServices: vi.fn() }));

vi.mock('../src/repositories/publicPageRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/publicPageRepository.js')>(
    '../src/repositories/publicPageRepository.js',
  );
  return { ...actual, ...repository };
});
vi.mock('../src/repositories/serviceRepository.js', () => serviceRepository);

import { PublicPageRepositoryError } from '../src/repositories/publicPageRepository.js';

import {
  archivePublicPageForAccount,
  createPublicPageForAccount,
  getPublicPageSlugAvailability,
  publishPublicPageForAccount,
  PublicPageServiceError,
  putPublicPageDraft,
  restorePublicPageForAccount,
} from '../src/services/publicPageService.js';

describe('public page service', () => {
  beforeEach(() => {
    Object.values(repository).forEach((mock) => mock.mockReset());
    serviceRepository.listServices.mockReset();
  });

  const record = (overrides: Record<string, unknown> = {}) => ({
    id: 'page-1',
    account_id: 9,
    status: 'draft',
    draft_document: validPublicPageDocument,
    published_document: null,
    revision: 3,
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
    published_at: null,
    archived_at: null,
    ...overrides,
  });

  const withServices = (serviceIds: number[]) => ({
    ...validPublicPageDocument,
    sections: [{
      ...validPublicPageDocument.sections[0],
      blocks: [{
        ...validPublicPageDocument.sections[0]!.blocks[0],
        type: 'services',
        content: {
          title: 'Services', serviceIds, autoplayIntervalSeconds: null, showBookingButton: true,
        },
      }],
    }],
  });

  it('creates a server-owned draft with normalized slug and timestamps', async () => {
    repository.createPublicPage.mockImplementation(async (input) => record({
      draft_document: input.document,
      revision: 1,
    }));
    const result = await createPublicPageForAccount(9, {
      ...validPublicPageDocument,
      slug: ' Valid-Page ',
      status: 'published',
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    expect(repository.createPublicPage).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 9,
      quota: 10,
      document: expect.objectContaining({
        slug: 'valid-page',
        status: 'draft',
        createdAt: expect.not.stringContaining('2000-01-01'),
      }),
    }));
    expect(result.status).toBe('draft');
    expect(serviceRepository.listServices).not.toHaveBeenCalled();
  });

  it('accepts account-owned service IDs on create', async () => {
    serviceRepository.listServices.mockResolvedValue([{ id: 7 }, { id: 9 }]);
    repository.createPublicPage.mockImplementation(async (input) => record({
      draft_document: input.document,
      revision: 1,
    }));

    await expect(createPublicPageForAccount(9, withServices([7, 9]))).resolves.toMatchObject({
      status: 'draft',
    });

    expect(serviceRepository.listServices).toHaveBeenCalledWith(9);
    expect(repository.createPublicPage).toHaveBeenCalledOnce();
  });

  it('rejects foreign or missing service IDs on create without revealing which ID failed', async () => {
    serviceRepository.listServices.mockResolvedValue([{ id: 7 }]);

    await expect(createPublicPageForAccount(9, withServices([7, 999])))
      .rejects.toMatchObject<Partial<PublicPageServiceError>>({ code: 'INVALID_DOCUMENT' });

    expect(repository.createPublicPage).not.toHaveBeenCalled();
  });

  it('preserves invalid_document when locked create revalidation detects a deleted service', async () => {
    serviceRepository.listServices.mockResolvedValue([{ id: 7 }]);
    repository.createPublicPage.mockRejectedValue(
      new PublicPageRepositoryError('MISSING_SERVICES', undefined, [7]),
    );

    await expect(createPublicPageForAccount(9, withServices([7])))
      .rejects.toMatchObject<Partial<PublicPageServiceError>>({ code: 'INVALID_DOCUMENT' });
  });

  it('normalizes a free slug and checks it without a page exemption', async () => {
    repository.isPublicPageSlugAvailable.mockResolvedValue(true);

    await expect(getPublicPageSlugAvailability(9, ' Valid-Page ')).resolves.toEqual({
      slug: 'valid-page',
      available: true,
    });
    expect(repository.isPublicPageSlugAvailable).toHaveBeenCalledWith('valid-page', undefined);
    expect(repository.findPublicPage).not.toHaveBeenCalled();
  });

  it('verifies page ownership before applying its slug exemption', async () => {
    repository.findPublicPage.mockResolvedValue(record());
    repository.isPublicPageSlugAvailable.mockResolvedValue(true);

    await expect(getPublicPageSlugAvailability(9, 'valid-page', 'page-1')).resolves.toEqual({
      slug: 'valid-page',
      available: true,
    });
    expect(repository.findPublicPage).toHaveBeenCalledWith(9, 'page-1');
    expect(repository.isPublicPageSlugAvailable).toHaveBeenCalledWith('valid-page', 'page-1');
  });

  it.each([
    ['a missing or foreign page', null],
    ['an archived page', record({ status: 'archived' })],
  ])('does not exempt %s', async (_label, page) => {
    repository.findPublicPage.mockResolvedValue(page);

    await expect(getPublicPageSlugAvailability(9, 'valid-page', 'page-1'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repository.isPublicPageSlugAvailable).not.toHaveBeenCalled();
  });

  it('rejects invalid and reserved slugs before repository access', async () => {
    await expect(getPublicPageSlugAvailability(9, 'Public-Pages'))
      .rejects.toMatchObject<Partial<PublicPageServiceError>>({ code: 'INVALID_SLUG' });
    expect(repository.findPublicPage).not.toHaveBeenCalled();
    expect(repository.isPublicPageSlugAvailable).not.toHaveBeenCalled();
  });

  it('normalizes slug and uses expected revision when saving', async () => {
    repository.findPublicPage.mockResolvedValue(record());
    repository.savePublicPageDraft.mockImplementation(async (input) => ({
      ...record(),
      draft_document: input.document,
      revision: 4,
    }));
    await putPublicPageDraft({
      accountId: 9,
      pageId: 'page-1',
      document: { ...validPublicPageDocument, slug: ' Valid-Page ' },
      expectedRevision: 3,
    });
    expect(repository.savePublicPageDraft).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 9,
      expectedRevision: 3,
      document: expect.objectContaining({ slug: 'valid-page', status: 'draft' }),
    }));
  });

  it('rejects missing service IDs on save before persisting the draft', async () => {
    serviceRepository.listServices.mockResolvedValue([]);

    await expect(putPublicPageDraft({
      accountId: 9,
      pageId: 'page-1',
      document: withServices([7]),
      expectedRevision: 3,
    })).rejects.toMatchObject<Partial<PublicPageServiceError>>({ code: 'INVALID_DOCUMENT' });

    expect(repository.findPublicPage).not.toHaveBeenCalled();
    expect(repository.savePublicPageDraft).not.toHaveBeenCalled();
  });

  it('preserves invalid_document when locked draft revalidation detects a deleted service', async () => {
    serviceRepository.listServices.mockResolvedValue([{ id: 7 }]);
    repository.findPublicPage.mockResolvedValue(record({ draft_document: withServices([7]) }));
    repository.savePublicPageDraft.mockRejectedValue(
      new PublicPageRepositoryError('MISSING_SERVICES', undefined, [7]),
    );

    await expect(putPublicPageDraft({
      accountId: 9, pageId: 'page-1', document: withServices([7]), expectedRevision: 3,
    })).rejects.toMatchObject<Partial<PublicPageServiceError>>({ code: 'INVALID_DOCUMENT' });
  });

  it('rejects unsupported versions distinctly', async () => {
    await expect(putPublicPageDraft({
      accountId: 1,
      pageId: 'page-1',
      document: { ...validPublicPageDocument, schemaVersion: 3 },
      expectedRevision: 0,
    })).rejects.toMatchObject<Partial<PublicPageServiceError>>({ code: 'UNSUPPORTED_VERSION' });
  });

  it('rejects unknown blocks before publish', async () => {
    const draft = structuredClone(validPublicPageDocument);
    draft.sections[0]!.blocks[0]!.type = 'future-block';
    repository.findPublicPage.mockResolvedValue({
      ...record({ account_id: 1, draft_document: draft }),
    });
    await expect(publishPublicPageForAccount(1, 'page-1', 3))
      .rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    expect(repository.publishPublicPage).not.toHaveBeenCalled();
  });

  it('publishes a server-owned immutable snapshot and advances lifecycle timestamps', async () => {
    repository.findPublicPage.mockResolvedValue(record({
      draft_document: {
        ...validPublicPageDocument,
        sections: [{
          ...validPublicPageDocument.sections[0],
          blocks: [{
            ...validPublicPageDocument.sections[0]!.blocks[0],
            content: {
              document: {
                type: 'rich-text-v1',
                paragraphs: [{
                  size: 'medium',
                  fontFamily: null,
                  alignment: 'left',
                  runs: [{ text: 'Published' }],
                }],
              },
            },
          }],
        }],
      },
    }));
    repository.publishPublicPage.mockImplementation(async (_accountId, _pageId, _revision, document) => record({
      status: 'published',
      published_document: structuredClone(document),
      revision: 4,
      published_at: '2026-07-28T01:00:00.000Z',
    }));
    const result = await publishPublicPageForAccount(9, 'page-1', 3);
    expect(result).toMatchObject({
      status: 'published',
      revision: 4,
      publishedAt: '2026-07-28T01:00:00.000Z',
      archivedAt: null,
    });
    expect(result.published).not.toBe(result.draft);
    expect(repository.publishPublicPage).toHaveBeenCalledWith(
      9, 'page-1', 3, expect.objectContaining({ status: 'published' }),
    );
  });

  it('rechecks service ownership on publish and returns stable validation issues', async () => {
    repository.findPublicPage.mockResolvedValue(record({ draft_document: withServices([7]) }));
    serviceRepository.listServices.mockResolvedValue([]);

    await expect(publishPublicPageForAccount(9, 'page-1', 3)).rejects.toMatchObject({
      code: 'PUBLISH_VALIDATION_FAILED',
      issues: [{
        code: 'missing_service',
        path: 'blocks.block-1.content.serviceIds',
        blockId: 'block-1',
      }],
    });

    expect(serviceRepository.listServices).toHaveBeenCalledWith(9);
    expect(repository.publishPublicPage).not.toHaveBeenCalled();
  });

  it('preserves publish missing_service issues when locked revalidation detects deletion', async () => {
    repository.findPublicPage.mockResolvedValue(record({ draft_document: withServices([7]) }));
    serviceRepository.listServices.mockResolvedValue([{ id: 7 }]);
    repository.publishPublicPage.mockRejectedValue(
      new PublicPageRepositoryError('MISSING_SERVICES', undefined, [7]),
    );

    await expect(publishPublicPageForAccount(9, 'page-1', 3)).rejects.toMatchObject({
      code: 'PUBLISH_VALIDATION_FAILED',
      issues: [{
        code: 'missing_service',
        path: 'blocks.block-1.content.serviceIds',
        blockId: 'block-1',
      }],
    });
  });

  it('archives by clearing the published snapshot and setting archivedAt', async () => {
    repository.archivePublicPage.mockResolvedValue(record({
      status: 'archived',
      draft_document: { ...validPublicPageDocument, status: 'archived' },
      published_document: null,
      revision: 5,
      archived_at: '2026-07-28T02:00:00.000Z',
    }));
    const result = await archivePublicPageForAccount(9, 'page-1', 4);
    expect(result).toMatchObject({
      status: 'archived',
      draft: expect.objectContaining({ status: 'archived' }),
      published: null,
      revision: 5,
      archivedAt: '2026-07-28T02:00:00.000Z',
    });
  });

  it('restores through the repository with the shared account quota and returns a draft DTO', async () => {
    repository.restorePublicPage.mockResolvedValue(record({
      status: 'draft',
      draft_document: { ...validPublicPageDocument, status: 'draft' },
      published_document: null,
      revision: 6,
      published_at: '2026-07-28T01:00:00.000Z',
      archived_at: null,
    }));

    const result = await restorePublicPageForAccount(9, 'page-1', 5);

    expect(repository.restorePublicPage).toHaveBeenCalledWith(9, 'page-1', 5, 10);
    expect(result).toMatchObject({
      status: 'draft',
      draft: expect.objectContaining({ status: 'draft' }),
      published: null,
      revision: 6,
      publishedAt: '2026-07-28T01:00:00.000Z',
      archivedAt: null,
    });
  });
});
