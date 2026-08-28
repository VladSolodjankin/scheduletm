import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { editorReducer, createEditorState } from '../model/editorReducer';
import { isPublishValidationResultCurrent, validateForPublish, type PublishValidationIssue } from '../model/publishValidation';
import { normalizeSlug, validateSlug, type SlugAvailabilityState } from '../model/slug';
import type { EditorAction } from '../types/actions';
import type { EditorState } from '../types/editor';
import type { PublicPageDocument } from '../types/publicPage';
import {
  PublicPageRepositoryError,
  type PublicPageRecord,
  type PublicPageRepository,
} from '../repository/PublicPageRepository';

type Options = {
  document: PublicPageDocument;
  revision: number;
  repository: PublicPageRepository;
  publishedSlug?: string | null;
  autosaveMs?: number;
};

function documentsHaveSameValue(left: PublicPageDocument, right: PublicPageDocument): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

export function reduceEditorActionForMutationTracking(
  current: EditorState,
  action: EditorAction,
): { state: EditorState; documentChanged: boolean } {
  const candidate = editorReducer(current, action);
  const candidateChangedDocument = candidate.document !== current.document;
  const documentChanged = candidateChangedDocument
    && !documentsHaveSameValue(current.document, candidate.document);
  return {
    state: candidateChangedDocument && !documentChanged ? current : candidate,
    documentChanged,
  };
}

export function usePublicPageEditor({
  document,
  revision,
  repository,
  publishedSlug: initialPublishedSlug = null,
  autosaveMs = 10_000,
}: Options) {
  const [state, setState] = useState(() => createEditorState(document));
  const stateRef = useRef(state);
  const latestDocument = useRef(state.document);
  const localEditRevisionRef = useRef(0);
  const serverRevisionRef = useRef(revision);
  const inFlightSaveRef = useRef<Promise<PublicPageRecord | null> | null>(null);
  const inFlightPublishRef = useRef<Promise<PublishValidationIssue[]> | null>(null);
  const publishOperationGenerationRef = useRef(0);
  const slugAvailabilityRequestRef = useRef(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [conflict, setConflict] = useState<PublicPageRecord | null | undefined>(undefined);
  const [publishIssues, setPublishIssues] = useState<PublishValidationIssue[]>([]);
  const [slugAvailability, setSlugAvailability] = useState<SlugAvailabilityState>({ status: 'idle', slug: null });
  const [publishedSlug, setPublishedSlug] = useState<string | null>(
    initialPublishedSlug ? normalizeSlug(initialPublishedSlug) : null,
  );
  const applyAction = useCallback((action: EditorAction, trackDocumentMutation: boolean) => {
    const current = stateRef.current;
    const reduction = trackDocumentMutation
      ? reduceEditorActionForMutationTracking(current, action)
      : { state: editorReducer(current, action), documentChanged: false };
    if (trackDocumentMutation && reduction.documentChanged) {
      localEditRevisionRef.current += 1;
      setPublishIssues([]);
    }
    stateRef.current = reduction.state;
    latestDocument.current = reduction.state.document;
    if (reduction.state !== current) {setState(reduction.state);}
  }, []);
  const dispatch = useCallback((action: EditorAction) => applyAction(action, false), [applyAction]);
  const canonicalSlug = normalizeSlug(state.document.slug);
  useEffect(() => {
    latestDocument.current = state.document;
  }, [state.document]);

  useEffect(() => {
    const requestId = ++slugAvailabilityRequestRef.current;
    if (validateSlug(canonicalSlug) !== null) {
      return;
    }

    queueMicrotask(() => {
      if (slugAvailabilityRequestRef.current === requestId) {
        setSlugAvailability({ status: 'checking', slug: canonicalSlug });
      }
    });
    const timeout = window.setTimeout(() => {
      void repository.checkSlugAvailability(canonicalSlug, state.document.id)
        .then((result) => {
          if (slugAvailabilityRequestRef.current !== requestId) {return;}
          if (result.slug !== canonicalSlug) {
            setSlugAvailability({ status: 'error', slug: canonicalSlug });
            return;
          }
          setSlugAvailability({
            status: result.available ? 'available' : 'unavailable',
            slug: canonicalSlug,
          });
        })
        .catch(() => {
          if (slugAvailabilityRequestRef.current !== requestId) {return;}
          setSlugAvailability({ status: 'error', slug: canonicalSlug });
        });
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      if (slugAvailabilityRequestRef.current === requestId) {
        slugAvailabilityRequestRef.current += 1;
      }
    };
  }, [canonicalSlug, repository, state.document.id]);

  const editorDispatch = useCallback((action: EditorAction) => {
    applyAction(action, true);
  }, [applyAction]);

  const save = useCallback(async () => {
    if (conflict !== undefined || inFlightPublishRef.current) {
      return null;
    }
    if (inFlightSaveRef.current) {
      return inFlightSaveRef.current;
    }
    const operation = (async () => {
      const localRevision = localEditRevisionRef.current;
      const snapshot = latestDocument.current;
      dispatch({ type: 'save/status', status: 'saving' });
      try {
        const saved = await repository.saveDraft(snapshot, serverRevisionRef.current);
        serverRevisionRef.current = saved.revision;
        if (localEditRevisionRef.current !== localRevision) {
          dispatch({ type: 'save/status', status: 'idle' });
          return null;
        }
        latestDocument.current = saved.draft;
        dispatch({ type: 'save/succeeded', document: saved.draft });
        return saved;
      } catch (error) {
        if (error instanceof PublicPageRepositoryError && error.code === 'revision_conflict') {
          setConflict(error.current ?? null);
        }
        dispatch({
          type: 'save/status',
          status: 'error',
          error: error instanceof Error ? error.message : 'save_failed',
        });
        return null;
      } finally {
        inFlightSaveRef.current = null;
      }
    })();
    inFlightSaveRef.current = operation;
    return operation;
  }, [conflict, dispatch, repository]);

  useEffect(() => {
    if (conflict !== undefined || !state.dirty || state.saveStatus === 'saving' || isPublishing) {return;}
    const timeout = window.setTimeout(() => void save(), autosaveMs);
    return () => window.clearTimeout(timeout);
  }, [autosaveMs, conflict, isPublishing, save, state.dirty, state.document, state.saveStatus]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.dirty) {return;}
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.dirty]);

  const publish = useCallback(async (): Promise<PublishValidationIssue[]> => {
    if (conflict !== undefined) {return [];}
    if (inFlightPublishRef.current) {
      return inFlightPublishRef.current;
    }
    const operationGeneration = ++publishOperationGenerationRef.current;
    const coreOperation = (async () => {
      const validation = validateForPublish(latestDocument.current);
      if (!validation.valid) {
        setPublishIssues(validation.issues);
        dispatch({ type: 'publish/errors', errors: validation.issues.map((issue) => issue.path) });
        const first = validation.issues[0];
        if (first?.sectionId) {
          dispatch({ type: 'selection/set', sectionId: first.sectionId, blockId: first.blockId });
        }
        return validation.issues;
      }
      const saved = await save();
      if (!saved) {return [];}
      const localRevision = localEditRevisionRef.current;
      setIsPublishing(true);
      try {
        const published = await repository.publish(saved.id, saved.revision);
        serverRevisionRef.current = published.revision;
        setPublishedSlug(normalizeSlug(published.published?.slug ?? published.draft.slug));
        if (!isPublishValidationResultCurrent(localRevision, localEditRevisionRef.current)) {
          dispatch({ type: 'save/status', status: 'idle' });
          return [];
        }
        latestDocument.current = published.draft;
        setPublishIssues([]);
        dispatch({ type: 'publish/succeeded', document: published.draft });
        return [];
      } catch (error) {
        if (error instanceof PublicPageRepositoryError && error.code === 'revision_conflict') {
          setConflict(error.current ?? null);
          dispatch({ type: 'save/status', status: 'error', error: 'revision_conflict' });
        }
        if (!isPublishValidationResultCurrent(localRevision, localEditRevisionRef.current)) {
          return [];
        }
        const issues = error instanceof PublicPageRepositoryError ? error.issues ?? [] : [];
        setPublishIssues(issues);
        dispatch({ type: 'publish/errors', errors: issues.length ? issues.map((issue) => issue.path) : ['publish'] });
        return issues;
      } finally {
        setIsPublishing(false);
      }
    })();
    const operation = coreOperation.finally(() => {
      if (publishOperationGenerationRef.current === operationGeneration) {
        inFlightPublishRef.current = null;
      }
    });
    inFlightPublishRef.current = operation;
    return operation;
  }, [conflict, dispatch, repository, save]);

  const reloadLatest = useCallback(async (): Promise<boolean> => {
    if (conflict === undefined) {return false;}
    try {
      const latest = conflict ?? await repository.get(latestDocument.current.id);
      serverRevisionRef.current = latest.revision;
      localEditRevisionRef.current = 0;
      latestDocument.current = latest.draft;
      setPublishedSlug(latest.published ? normalizeSlug(latest.published.slug) : null);
      setPublishIssues([]);
      setConflict(undefined);
      dispatch({ type: 'document/replace', document: latest.draft });
      return true;
    } catch {
      return false;
    }
  }, [conflict, dispatch, repository]);

  const currentSlugAvailability = useMemo<SlugAvailabilityState>(() => (
    validateSlug(canonicalSlug) === null && slugAvailability.slug === canonicalSlug
      ? slugAvailability
      : { status: 'idle', slug: null }
  ), [canonicalSlug, slugAvailability]);

  return useMemo(() => ({
    state,
    dispatch: editorDispatch as Dispatch<EditorAction>,
    save,
    publish,
    publishIssues,
    slugAvailability: currentSlugAvailability,
    publishedSlug,
    hasConflict: conflict !== undefined,
    reloadLatest,
    isPublishing,
  }), [conflict, currentSlugAvailability, editorDispatch, isPublishing, publish, publishedSlug, publishIssues, reloadLatest, save, state]);
}
