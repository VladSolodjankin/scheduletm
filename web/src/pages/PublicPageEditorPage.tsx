import { ContentCopy, OpenInNew } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Snackbar, Stack } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlockLibrary } from '../components/public-page-builder/BlockLibrary';
import { BlockTree } from '../components/public-page-builder/BlockTree';
import { BuilderShell } from '../components/public-page-builder/BuilderShell';
import { BuilderToolbar } from '../components/public-page-builder/BuilderToolbar';
import { DeviceSwitcher, type PreviewDevice } from '../components/public-page-builder/DeviceSwitcher';
import { InspectorPanel } from '../components/public-page-builder/InspectorPanel';
import { ResponsivePreview } from '../components/public-page-builder/ResponsivePreview';
import { publicPageText } from '../components/public-page-builder/uiText';
import { createBlankPublicPageDocument } from '../components/public-page-builder/createBlankDocument';
import { usePublicPageEditor } from '../features/public-page-builder/hooks/usePublicPageEditor';
import { createBlock } from '../features/public-page-builder/model/blockRegistry';
import { selectCanRedo, selectCanUndo } from '../features/public-page-builder/model/selectors';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import type { PublicPageRecord } from '../features/public-page-builder/repository/PublicPageRepository';
import type { PageBlock, PageSection } from '../features/public-page-builder/types/publicPage';
import { createStableId } from '../features/public-page-builder/utils/createStableId';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';

function cloneBlock(block: PageBlock): PageBlock {
  return { ...structuredClone(block), id: createStableId() };
}

function Editor({
  record,
  repository,
}: {
  record: PublicPageRecord;
  repository: ApiPublicPageRepository;
}) {
  const { locale } = useI18n();
  const editor = usePublicPageEditor({
    document: record.draft,
    revision: record.revision,
    repository,
  });
  const { state, dispatch } = editor;
  const [device, setDevice] = useState<PreviewDevice>('mobile');
  const [copied, setCopied] = useState(false);

  const addSection = () => {
    const section: PageSection = {
      id: createStableId(),
      name: `${publicPageText(locale, 'section')} ${state.document.sections.length + 1}`,
      visible: true,
      layout: 'single',
      blocks: [],
    };
    dispatch({ type: 'section/add', section });
    dispatch({ type: 'selection/set', sectionId: section.id });
  };
  const addBlock = (type: string) => {
    const block = createBlock(type);
    if (!block) {return;}
    let sectionId = state.selection.sectionId ?? state.document.sections[0]?.id;
    if (!sectionId) {
      sectionId = createStableId();
      dispatch({
        type: 'section/add',
        section: {
          id: sectionId,
          name: `${publicPageText(locale, 'section')} 1`,
          visible: true,
          layout: 'single',
          blocks: [],
        },
      });
    }
    dispatch({ type: 'block/add', sectionId, block });
    dispatch({ type: 'selection/set', sectionId, blockId: block.id });
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(`https://meetli.cc/${state.document.slug}`);
    setCopied(true);
  };

  return (
    <>
    <BuilderShell
      toolbar={
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <BuilderToolbar
              locale={locale}
              saveStatus={state.saveStatus}
              isPublishing={editor.isPublishing}
              canUndo={selectCanUndo(state)}
              canRedo={selectCanRedo(state)}
              hasPublishErrors={state.publishErrors.length > 0}
              onSave={() => void editor.save()}
              onUndo={() => dispatch({ type: 'history/undo' })}
              onRedo={() => dispatch({ type: 'history/redo' })}
              onPublish={() => void editor.publish()}
            />
            <Stack direction="row" spacing={1}>
              <DeviceSwitcher locale={locale} value={device} onChange={setDevice} />
              <Button startIcon={<ContentCopy />} onClick={() => void copyLink()}>{publicPageText(locale, 'copyLink')}</Button>
              {state.document.status === 'published' ? (
                <Button startIcon={<OpenInNew />} href={`/${state.document.slug}`} target="_blank">{publicPageText(locale, 'open')}</Button>
              ) : null}
            </Stack>
          </Stack>
          {editor.hasConflict ? (
            <Alert severity="error" action={<Button onClick={() => void editor.reloadLatest()}>{publicPageText(locale, 'reloadLatest')}</Button>}>
              {publicPageText(locale, 'revisionConflict')}
            </Alert>
          ) : state.saveStatus === 'error' ? (
            <Alert severity="error" action={<Button onClick={() => void editor.save()}>{publicPageText(locale, 'retry')}</Button>}>
              {publicPageText(locale, state.saveError === 'revision_conflict' ? 'revisionConflict' : 'saveError')}
            </Alert>
          ) : null}
          {editor.publishIssues.length > 0 ? (
            <Alert severity="warning">
              {publicPageText(locale, 'validation')}
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {editor.publishIssues.map((issue, index) => (
                  <li key={`${issue.path}-${issue.code}-${index}`}>
                    {issue.path}{issue.detail ? `: ${issue.detail}` : ''}
                  </li>
                ))}
              </Box>
            </Alert>
          ) : null}
        </Stack>
      }
      tree={
        <Stack spacing={2}>
          <BlockTree
            locale={locale}
            document={state.document}
            selection={state.selection}
            onSelect={(sectionId, blockId) => dispatch({ type: 'selection/set', sectionId, blockId })}
            onAddSection={addSection}
            onMoveSection={(sectionId, toIndex) => dispatch({ type: 'section/reorder', sectionId, toIndex })}
            onMoveBlock={(sectionId, blockId, toIndex) => dispatch({ type: 'block/reorder', sectionId, blockId, toIndex })}
            onToggleSection={(sectionId) => dispatch({ type: 'section/toggle', sectionId })}
            onToggleBlock={(sectionId, blockId) => dispatch({ type: 'block/toggle', sectionId, blockId })}
            onRemoveSection={(sectionId) => dispatch({ type: 'section/remove', sectionId })}
            onRemoveBlock={(sectionId, blockId) => dispatch({ type: 'block/remove', sectionId, blockId })}
            onDuplicateSection={(sectionId) => {
              const original = state.document.sections.find((section) => section.id === sectionId);
              if (!original) {return;}
              dispatch({
                type: 'section/add',
                section: { ...structuredClone(original), id: createStableId(), blocks: original.blocks.map(cloneBlock) },
              });
            }}
            onDuplicateBlock={(sectionId, blockId) => {
              const original = state.document.sections.find((section) => section.id === sectionId)?.blocks.find((block) => block.id === blockId);
              if (original) {dispatch({ type: 'block/add', sectionId, block: cloneBlock(original) });}
            }}
          />
          <BlockLibrary locale={locale} onAdd={addBlock} />
        </Stack>
      }
      preview={<ResponsivePreview document={state.document} device={device} />}
      inspector={<InspectorPanel state={state} locale={locale} dispatch={dispatch} />}
    />
    <Snackbar
      open={copied}
      autoHideDuration={1800}
      message={publicPageText(locale, 'linkCopied')}
      onClose={() => setCopied(false)}
    />
    </>
  );
}

export function PublicPageEditorPage() {
  const { profileId = '' } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { locale } = useI18n();
  const repository = useMemo(() => new ApiPublicPageRepository(accessToken), [accessToken]);
  const creationStartedRef = useRef(false);
  const [record, setRecord] = useState<PublicPageRecord | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const createNew = useCallback(async () => {
    if (creationStartedRef.current) {return;}
    creationStartedRef.current = true;
    setStatus('loading');
    try {
      const created = await repository.create(createBlankPublicPageDocument());
      navigate(`/public-pages/${created.id}/edit`, { replace: true });
    } catch {
      creationStartedRef.current = false;
      setStatus('error');
    }
  }, [navigate, repository]);
  const load = useCallback(async () => {
    try {
      const item = await repository.get(profileId);
      setRecord(item);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [profileId, repository]);
  useEffect(() => {
    if (!profileId) {
      void Promise.resolve().then(createNew);
      return;
    }
    void Promise.resolve().then(load);
  }, [createNew, load, profileId]);
  const content = useMemo(() => {
    if (status === 'loading') {return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;}
    if (status === 'error' || !record) {
      const retry = profileId ? load : createNew;
      return <Alert severity="error" action={<Button onClick={() => void retry()}>{publicPageText(locale, 'retry')}</Button>}>{publicPageText(locale, 'notFound')}</Alert>;
    }
    return <Editor record={record} repository={repository} />;
  }, [createNew, load, locale, profileId, record, repository, status]);
  return content;
}
