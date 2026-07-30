import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const repository = vi.hoisted(() => ({
  listPublicPages: vi.fn(),
  findPublicPage: vi.fn(),
  findPublishedPublicPageBySlug: vi.fn(),
  createPublicPage: vi.fn(),
  savePublicPageDraft: vi.fn(),
  publishPublicPage: vi.fn(),
  archivePublicPage: vi.fn(),
  deletePublicPage: vi.fn(),
}));

vi.mock('../src/repositories/publicPageRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/publicPageRepository.js')>(
    '../src/repositories/publicPageRepository.js',
  );
  return { ...actual, ...repository };
});

import {
  archivePublicPageForAccount,
  createPublicPageForAccount,
  publishPublicPageForAccount,
  PublicPageServiceError,
  putPublicPageDraft,
} from '../src/services/publicPageService.js';

describe('public page service', () => {
  beforeEach(() => Object.values(repository).forEach((mock) => mock.mockReset()));

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

  it('rejects unsupported versions distinctly', async () => {
    await expect(putPublicPageDraft({
      accountId: 1,
      pageId: 'page-1',
      document: { ...validPublicPageDocument, schemaVersion: 2 },
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
      .rejects.toMatchObject({ code: 'PUBLISH_VALIDATION_FAILED' });
    expect(repository.publishPublicPage).not.toHaveBeenCalled();
  });

  it('publishes a server-owned immutable snapshot and advances lifecycle timestamps', async () => {
    repository.findPublicPage.mockResolvedValue(record({
      draft_document: {
        ...validPublicPageDocument,
        sections: [{
          ...validPublicPageDocument.sections[0],
          blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], content: { body: 'Published' } }],
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
});
