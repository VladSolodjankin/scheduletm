// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublicPageEditor } from '../../src/features/public-page-builder/hooks/usePublicPageEditor';
import { getBlockDefinition, registerBlock } from '../../src/features/public-page-builder/model/blockRegistry';
import { normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import { validateForPublish } from '../../src/features/public-page-builder/model/publishValidation';
import {
  PublicPageRepositoryError,
  type PublicPageRecord,
  type PublicPageRepository,
} from '../../src/features/public-page-builder/repository/PublicPageRepository';
import type { PublicPageDocument } from '../../src/features/public-page-builder/types/publicPage';

type Editor = ReturnType<typeof usePublicPageEditor>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

const mountedRoots: Root[] = [];

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function validDocument(slug = 'runtime-page'): PublicPageDocument {
  if (!getBlockDefinition('divider')) {
    registerBlock({
      type: 'divider',
      name: 'Divider',
      createContent: () => ({}),
      Renderer: () => null,
      validate: () => [],
    });
  }
  const document = normalizeDocument({
    id: 'page-1',
    slug,
    status: 'draft',
    seo: { title: 'Runtime page', description: 'Runtime page description' },
    sections: [{
      id: 'section-1',
      visible: true,
      blocks: [{ id: 'runtime-block-1', type: 'divider', visible: true, content: {} }],
    }],
  });
  const validation = validateForPublish(document);
  if (!validation.valid) {throw new Error(`invalid runtime fixture: ${JSON.stringify(validation.issues)}`);}
  return document;
}

function record(document: PublicPageDocument, revision: number, published: PublicPageDocument | null = null): PublicPageRecord {
  return {
    id: document.id,
    draft: document,
    published,
    status: published ? 'published' : 'draft',
    revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    publishedAt: published ? document.updatedAt : null,
    archivedAt: null,
  };
}

function repositoryMock(overrides: Partial<PublicPageRepository> = {}): PublicPageRepository {
  const unexpected = async () => {throw new Error('unexpected repository call');};
  return {
    list: unexpected,
    checkSlugAvailability: async (slug) => ({ slug, available: true }),
    get: unexpected,
    create: unexpected,
    saveDraft: unexpected,
    archive: unexpected,
    restore: unexpected,
    delete: unexpected,
    publish: unexpected,
    getBySlug: unexpected,
    ...overrides,
  } as PublicPageRepository;
}

async function mountEditor(
  document: PublicPageDocument,
  repository: PublicPageRepository,
  autosaveMs = 100,
) {
  let current: Editor | undefined;
  function Harness() {
    current = usePublicPageEditor({ document, revision: 1, repository, autosaveMs });
    return null;
  }
  const container = window.document.createElement('div');
  window.document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => {
    root.render(createElement(Harness));
  });
  return {
    get current() {
      if (!current) {throw new Error('editor hook was not captured');}
      return current;
    },
    container,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  for (const root of mountedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  window.document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePublicPageEditor runtime lifecycle', () => {
  it('debounces saves, serializes them, and advances the revision after an edit during save', async () => {
    const firstSave = deferred<PublicPageRecord>();
    const secondSave = deferred<PublicPageRecord>();
    const saveDraft = vi.fn()
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise);
    const editor = await mountEditor(validDocument(), repositoryMock({ saveDraft }));

    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'First edit' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(99);
    });
    expect(saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft.mock.calls[0][0].seo.title).toBe('First edit');
    expect(saveDraft.mock.calls[0][1]).toBe(1);

    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'Edit during save' } });
      vi.advanceTimersByTime(1_000);
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve(record(saveDraft.mock.calls[0][0], 2));
      await firstSave.promise;
    });
    expect(editor.current.state.dirty).toBe(true);
    expect(editor.current.state.document.seo.title).toBe('Edit during save');

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft.mock.calls[1][0].seo.title).toBe('Edit during save');
    expect(saveDraft.mock.calls[1][1]).toBe(2);

    await act(async () => {
      secondSave.resolve(record(saveDraft.mock.calls[1][0], 3));
      await secondSave.promise;
    });
    expect(editor.current.state.dirty).toBe(false);
    expect(editor.current.state.saveStatus).toBe('saved');
  });

  it('coalesces publish calls and saves the draft before publishing its returned revision', async () => {
    const document = validDocument();
    const pendingSave = deferred<PublicPageRecord>();
    const pendingPublish = deferred<PublicPageRecord>();
    const saveDraft = vi.fn().mockReturnValue(pendingSave.promise);
    const publish = vi.fn().mockReturnValue(pendingPublish.promise);
    const editor = await mountEditor(document, repositoryMock({ saveDraft, publish }));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = editor.current.publish();
      second = editor.current.publish();
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();

    await act(async () => {
      pendingSave.resolve(record(document, 2));
      await pendingSave.promise;
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(document.id, 2);

    let firstIssues: unknown;
    let secondIssues: unknown;
    await act(async () => {
      pendingPublish.resolve(record(document, 3, document));
      [firstIssues, secondIssues] = await Promise.all([first, second]);
    });
    expect(firstIssues).toEqual([]);
    expect(secondIssues).toEqual([]);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(editor.current.publishedSlug).toBe(document.slug);
  });

  it('preserves an edit made during publish when the stale publish succeeds', async () => {
    const document = validDocument();
    const pendingPublish = deferred<PublicPageRecord>();
    const repository = repositoryMock({
      saveDraft: vi.fn().mockResolvedValue(record(document, 2)),
      publish: vi.fn().mockReturnValue(pendingPublish.promise),
    });
    const editor = await mountEditor(document, repository);
    let result!: Promise<unknown>;

    await act(async () => {
      result = editor.current.publish();
      await Promise.resolve();
    });
    expect(editor.current.isPublishing).toBe(true);
    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'Local title during publish' } });
    });

    let issues: unknown;
    await act(async () => {
      pendingPublish.resolve(record(document, 3, document));
      issues = await result;
    });
    expect(issues).toEqual([]);
    expect(editor.current.state.document.seo.title).toBe('Local title during publish');
    expect(editor.current.state.dirty).toBe(true);
    expect(editor.current.state.saveStatus).toBe('idle');
  });

  it('ignores stale server validation issues after an edit during publish', async () => {
    const document = validDocument();
    const pendingPublish = deferred<PublicPageRecord>();
    const serverIssues = [{ code: 'invalid_slug' as const, path: 'slug', detail: 'reserved' }];
    const editor = await mountEditor(document, repositoryMock({
      saveDraft: vi.fn().mockResolvedValue(record(document, 2)),
      publish: vi.fn().mockReturnValue(pendingPublish.promise),
    }));
    let result!: Promise<unknown>;

    await act(async () => {
      result = editor.current.publish();
      await Promise.resolve();
    });
    expect(editor.current.isPublishing).toBe(true);
    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'Newer local title' } });
    });

    let issues: unknown;
    await act(async () => {
      pendingPublish.reject(new PublicPageRepositoryError(
        'publish_validation_failed', undefined, undefined, undefined, serverIssues,
      ));
      issues = await result;
    });
    expect(issues).toEqual([]);
    expect(editor.current.publishIssues).toEqual([]);
    expect(editor.current.state.publishErrors).toEqual([]);
    expect(editor.current.state.document.seo.title).toBe('Newer local title');
  });

  it('applies current server validation issues when publish fails without a newer edit', async () => {
    const document = validDocument();
    const pendingPublish = deferred<PublicPageRecord>();
    const serverIssue = {
      code: 'invalid_block' as const,
      path: 'sections.0.blocks.0.content',
      sectionId: 'section-1',
      blockId: 'runtime-block-1',
      detail: 'content is no longer publishable',
    };
    const editor = await mountEditor(document, repositoryMock({
      saveDraft: vi.fn().mockResolvedValue(record(document, 2)),
      publish: vi.fn().mockReturnValue(pendingPublish.promise),
    }));
    let result!: Promise<unknown>;

    await act(async () => {
      result = editor.current.publish();
      await Promise.resolve();
    });
    expect(editor.current.isPublishing).toBe(true);

    let issues: unknown;
    await act(async () => {
      pendingPublish.reject(new PublicPageRepositoryError(
        'publish_validation_failed', undefined, undefined, undefined, [serverIssue],
      ));
      issues = await result;
    });

    expect(issues).toEqual([serverIssue]);
    expect(editor.current.publishIssues).toEqual([serverIssue]);
    expect(editor.current.state.publishErrors).toEqual([serverIssue.path]);
    expect(editor.current.isPublishing).toBe(false);
    expect(editor.current.state.saveStatus).toBe('saved');
  });

  it('freezes writes on conflict and reloads the embedded current record', async () => {
    const document = validDocument();
    const current = validDocument('server-current');
    const saveDraft = vi.fn().mockRejectedValue(new PublicPageRepositoryError(
      'revision_conflict', undefined, undefined, record(current, 6),
    ));
    const get = vi.fn();
    const editor = await mountEditor(document, repositoryMock({ saveDraft, get }));

    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'Conflicting edit' } });
    });
    await act(async () => {
      await editor.current.save();
    });
    expect(editor.current.hasConflict).toBe(true);
    expect(saveDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'Frozen local edit' } });
      await editor.current.save();
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);

    let reloaded = false;
    await act(async () => {
      reloaded = await editor.current.reloadLatest();
    });
    expect(reloaded).toBe(true);
    expect(get).not.toHaveBeenCalled();
    expect(editor.current.hasConflict).toBe(false);
    expect(editor.current.state.document.slug).toBe('server-current');
    expect(editor.current.state.dirty).toBe(false);
  });

  it('keeps fallback conflict state after reload failure and clears it after repository get succeeds', async () => {
    const document = validDocument();
    const latest = validDocument('repository-current');
    const saveDraft = vi.fn().mockRejectedValue(new PublicPageRepositoryError('revision_conflict'));
    const get = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(record(latest, 9));
    const editor = await mountEditor(document, repositoryMock({ saveDraft, get }));

    await act(async () => {
      editor.current.dispatch({ type: 'seo/update', changes: { title: 'Conflicting edit' } });
      await editor.current.save();
    });
    expect(editor.current.hasConflict).toBe(true);

    let firstReload = true;
    await act(async () => {
      firstReload = await editor.current.reloadLatest();
    });
    expect(firstReload).toBe(false);
    expect(editor.current.hasConflict).toBe(true);

    let secondReload = false;
    await act(async () => {
      secondReload = await editor.current.reloadLatest();
    });
    expect(secondReload).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
    expect(editor.current.hasConflict).toBe(false);
    expect(editor.current.state.document.slug).toBe('repository-current');
  });

  it('ignores a stale slug-availability response after the slug changes', async () => {
    const alpha = deferred<{ slug: string; available: boolean }>();
    const beta = deferred<{ slug: string; available: boolean }>();
    const checkSlugAvailability = vi.fn((slug: string) => slug === 'alpha-page' ? alpha.promise : beta.promise);
    const editor = await mountEditor(
      validDocument('alpha-page'),
      repositoryMock({ checkSlugAvailability }),
      10_000,
    );

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(checkSlugAvailability).toHaveBeenNthCalledWith(1, 'alpha-page', 'page-1');

    await act(async () => {
      editor.current.dispatch({ type: 'slug/update', slug: 'beta-page' });
    });
    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(checkSlugAvailability).toHaveBeenNthCalledWith(2, 'beta-page', 'page-1');

    beta.resolve({ slug: 'beta-page', available: true });
    await flush();
    expect(editor.current.slugAvailability).toEqual({ status: 'available', slug: 'beta-page' });

    alpha.resolve({ slug: 'alpha-page', available: false });
    await flush();
    expect(editor.current.slugAvailability).toEqual({ status: 'available', slug: 'beta-page' });
  });
});
