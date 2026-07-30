import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import { editorReducer, createEditorState } from '../model/editorReducer';
import { validateForPublish, type PublishValidationIssue } from '../model/publishValidation';
import type { EditorAction } from '../types/actions';
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
  autosaveMs?: number;
};

export function usePublicPageEditor({
  document,
  revision,
  repository,
  autosaveMs = 600,
}: Options) {
  const [state, dispatch] = useReducer(editorReducer, createEditorState(document));
  const latestDocument = useRef(state.document);
  const localEditRevisionRef = useRef(0);
  const serverRevisionRef = useRef(revision);
  const inFlightSaveRef = useRef<Promise<PublicPageRecord | null> | null>(null);
  const inFlightPublishRef = useRef<Promise<PublishValidationIssue[]> | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [conflict, setConflict] = useState<PublicPageRecord | null | undefined>(undefined);
  const [publishIssues, setPublishIssues] = useState<PublishValidationIssue[]>([]);
  useEffect(() => {
    latestDocument.current = state.document;
  }, [state.document]);

  const editorDispatch = useCallback((action: EditorAction) => {
    switch (action.type) {
      case 'profile/update':
      case 'seo/update':
      case 'slug/update':
      case 'theme/update':
      case 'section/add':
      case 'section/update':
      case 'section/remove':
      case 'section/reorder':
      case 'section/toggle':
      case 'block/add':
      case 'block/update':
      case 'block/design':
      case 'block/remove':
      case 'block/reorder':
      case 'block/toggle':
      case 'history/undo':
      case 'history/redo':
        localEditRevisionRef.current += 1;
        break;
      default:
        break;
    }
    dispatch(action);
  }, []);

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
  }, [conflict, repository]);

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
    const operation = (async () => {
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
        if (localEditRevisionRef.current !== localRevision) {
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
        const issues = error instanceof PublicPageRepositoryError ? error.issues ?? [] : [];
        setPublishIssues(issues);
        dispatch({ type: 'publish/errors', errors: issues.length ? issues.map((issue) => issue.path) : ['publish'] });
        return issues;
      } finally {
        setIsPublishing(false);
        inFlightPublishRef.current = null;
      }
    })();
    inFlightPublishRef.current = operation;
    return operation;
  }, [conflict, repository, save]);

  const reloadLatest = useCallback(async (): Promise<boolean> => {
    if (conflict === undefined) {return false;}
    try {
      const latest = conflict ?? await repository.get(latestDocument.current.id);
      serverRevisionRef.current = latest.revision;
      localEditRevisionRef.current = 0;
      latestDocument.current = latest.draft;
      setPublishIssues([]);
      setConflict(undefined);
      dispatch({ type: 'document/replace', document: latest.draft });
      return true;
    } catch {
      return false;
    }
  }, [conflict, repository]);

  return useMemo(() => ({
    state,
    dispatch: editorDispatch as Dispatch<EditorAction>,
    save,
    publish,
    publishIssues,
    hasConflict: conflict !== undefined,
    reloadLatest,
    isPublishing,
  }), [conflict, editorDispatch, isPublishing, publish, publishIssues, reloadLatest, save, state]);
}
