import { ArrowDownward, ArrowUpward, Close, ContentCopy, ContentCopyOutlined, DeleteOutlined, DragIndicator, EditOutlined, OpenInNew, PaletteOutlined, Settings, Visibility, VisibilityOff } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Snackbar, Stack, Tooltip } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddBlockDialog } from '../components/public-page-builder/AddBlockDialog';
import { BlockEditorDialog, type BlockEditorPreview } from '../components/public-page-builder/BlockEditorDialog';
import { BuilderShell } from '../components/public-page-builder/BuilderShell';
import { BuilderToolbar } from '../components/public-page-builder/BuilderToolbar';
import { DeviceSwitcher, type PreviewDevice } from '../components/public-page-builder/DeviceSwitcher';
import { InspectorPanel } from '../components/public-page-builder/InspectorPanel';
import { DesignPanel } from '../components/public-page-builder/DesignPanel';
import { ResponsivePreview } from '../components/public-page-builder/ResponsivePreview';
import { standaloneSectionFrom, type BuilderDragPayload, type BuilderDropDestination } from '../components/public-page-builder/BuilderSortable';
import { publicPageText } from '../components/public-page-builder/uiText';
import { createBlankPublicPageDocument } from '../components/public-page-builder/createBlankDocument';
import { usePublicPageEditor } from '../features/public-page-builder/hooks/usePublicPageEditor';
import { selectCanRedo, selectCanUndo } from '../features/public-page-builder/model/selectors';
import { canDeleteMediaFromDocuments } from '../features/public-page-builder/model/media';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import { PublicPageRepositoryError, type PublicPageRecord } from '../features/public-page-builder/repository/PublicPageRepository';
import type { MediaReference, PageBlock } from '../features/public-page-builder/types/publicPage';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../features/public-page-builder/model/socialPlatforms';
import { createStableId } from '../features/public-page-builder/utils/createStableId';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';

function cloneBlock(block: PageBlock): PageBlock {
  return { ...structuredClone(block), id: createStableId() };
}

function canDuplicateBlocks(blocks: readonly PageBlock[]): boolean {
  return !blocks.some((block) => block.type === 'social-button');
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
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [stagedBlocks, setStagedBlocks] = useState<PageBlock[]>([]);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [blockPreview, setBlockPreview] = useState<BlockEditorPreview | null>(null);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());
  const mediaUrlsRef = useRef(mediaUrls);
  const previewDocument = useMemo(() => {
    let document = state.document;
    if (blockPreview && state.selection.sectionId) {
      document = structuredClone(document);
      const source = document.sections.find((section) => section.id === state.selection.sectionId);
      const blockIndex = source?.blocks.findIndex((block) => block.id === blockPreview.block.id) ?? -1;
      if (source && blockIndex >= 0) {source.blocks[blockIndex] = structuredClone(blockPreview.block);}
      const section = document.sections.find((candidate) => candidate.id === blockPreview.sectionId);
      if (section && blockPreview.section) { Object.assign(section, structuredClone(blockPreview.section)); }
      document.media = [...new Map([...document.media, ...blockPreview.addedMedia.map((item) => item.media), ...blockPreview.updatedMedia]
        .map((media) => [media.id, media])).values()];
    }
    return document;
  }, [blockPreview, state.document, state.selection.sectionId]);
  const previewMediaUrls = useMemo(() => {
    const next = new Map(mediaUrls);
    blockPreview?.addedMedia.forEach((item) => next.set(item.media.id, item.objectUrl));
    return next;
  }, [blockPreview, mediaUrls]);
  const knownMediaIdsRef = useRef(new Set(record.draft.media.map((media) => media.id)));
  const pendingMediaDeletionIdsRef = useRef(new Set<string>());
  const mediaDeletionRunningRef = useRef(false);
  useEffect(() => { mediaUrlsRef.current = mediaUrls; }, [mediaUrls]);
  useEffect(() => {
    const currentIds = new Set(state.document.media.map((media) => media.id));
    currentIds.forEach((id) => knownMediaIdsRef.current.add(id));
    knownMediaIdsRef.current.forEach((id) => {
      const referencedByHistory = !canDeleteMediaFromDocuments([state.document, ...state.past, ...state.future], id);
      if (currentIds.has(id) || referencedByHistory) {
        pendingMediaDeletionIdsRef.current.delete(id);
        return;
      }
      pendingMediaDeletionIdsRef.current.add(id);
      const previewUrl = mediaUrlsRef.current.get(id);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setMediaUrls((current) => {
          const next = new Map(current); next.delete(id); return next;
        });
      }
    });
  }, [state.document, state.future, state.past]);
  useEffect(() => {
    if (state.dirty || state.saveStatus !== 'saved' || editor.isPublishing || mediaDeletionRunningRef.current) {return;}
    const pending = [...pendingMediaDeletionIdsRef.current].filter((id) =>
      canDeleteMediaFromDocuments([state.document, ...state.past, ...state.future], id));
    if (!pending.length) {return;}
    mediaDeletionRunningRef.current = true;
    void (async () => {
      for (const id of pending) {
        try {
          await repository.deleteMedia(id);
          pendingMediaDeletionIdsRef.current.delete(id);
          knownMediaIdsRef.current.delete(id);
        } catch (error) {
          if (!(error instanceof PublicPageRepositoryError && error.code === 'media_in_use')) {
            // Retain transient failures for the next successful save/publish boundary.
          }
        }
      }
    })().finally(() => { mediaDeletionRunningRef.current = false; });
  }, [editor.isPublishing, repository, state.dirty, state.future, state.past, state.saveStatus, state.document]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(state.document.media.filter((media) => !mediaUrlsRef.current.has(media.id)).map(async (media) => {
      try {
        const blob = await repository.getMediaPreview(media.id);
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setMediaUrls((current) => new Map(current).set(media.id, url));
        }
      } catch { /* A new or unpublished preview may not be available yet. */ }
    }));
    return () => { cancelled = true; };
  }, [repository, state.document.media]);
  useEffect(() => () => {
    mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const rememberMediaPreview = (media: MediaReference, url: string) => {
    setMediaUrls((current) => {
      const old = current.get(media.id); if (old && old !== url) {URL.revokeObjectURL(old);}
      return new Map(current).set(media.id, url);
    });
  };

  const addBlock = (block: PageBlock) => {
    setStagedBlocks((current) => [...current, block]);
  };
  const usedSocialPlatforms = useMemo(() => new Set([...state.document.sections.flatMap((section) => section.blocks), ...stagedBlocks]
    .filter((block) => block.type === 'social-button' && SOCIAL_PLATFORMS.includes(block.content.platform as SocialPlatform))
    .map((block) => block.content.platform as SocialPlatform)), [stagedBlocks, state.document.sections]);
  const copyLink = async () => {
    await navigator.clipboard.writeText(`https://meetli.cc/${state.document.slug}`);
    setCopied(true);
  };
  const onDropItem = (payload: BuilderDragPayload, destination: BuilderDropDestination) => {
    if (payload.type === 'staged') {
      const alreadyCommitted = state.document.sections.some((section) => section.blocks.some((block) => block.id === payload.block.id));
      const targetMissing = destination.type === 'section'
        && !state.document.sections.some((section) => section.id === destination.sectionId && section.design.variant !== 'off');
      if (alreadyCommitted || targetMissing) {return;}
    }
    const source = payload.type === 'block'
      ? state.document.sections.find((section) => section.id === payload.sourceSectionId)
      : state.document.sections.find((section) => section.design.variant === 'off') ?? state.document.sections[0];
    dispatch({
      type: 'layout/drop',
      item: payload.type === 'block' ? { type: 'block', blockId: payload.blockId } : payload,
      to: destination,
      standaloneSection: payload.type === 'section' || !source ? undefined : standaloneSectionFrom(source),
    });
    if (payload.type === 'staged') {
      setStagedBlocks((current) => current.filter((block) => block.id !== payload.block.id));
    }
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
              <Button startIcon={<Settings />} onClick={() => { dispatch({ type: 'selection/clear' }); setPageSettingsOpen(true); }}>{publicPageText(locale, 'pageSettings')}</Button>
              <Button startIcon={<PaletteOutlined />} onClick={() => { dispatch({ type: 'selection/clear' }); setDesignOpen(true); }}>{publicPageText(locale, 'design')}</Button>
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
      preview={<Box sx={{ height: '100%', minHeight: 0, position: 'relative' }}>
        <ResponsivePreview document={previewDocument} device={device} mediaUrls={previewMediaUrls}
          ariaLabel={publicPageText(locale, 'preview')} editor={{
          stagedBlocks,
          onDropItem,
          selectedBlockId: state.selection.blockId,
          blockAriaLabel: (name) => publicPageText(locale, 'blockEditorLabel').replace('{name}', name),
          onSelectBlock: (sectionId, blockId) => { dispatch({ type: 'selection/set', sectionId, blockId }); setBlockEditorOpen(true); },
          renderSectionActions: (section, sectionIndex) => <Stack className="public-page-section-actions" direction="row" sx={{ position: 'absolute', zIndex: 4, top: 0, left: 8, transform: 'translateY(-100%)', p: 0.25, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 3, opacity: { xs: state.selection.sectionId === section.id && !state.selection.blockId ? 1 : 0, md: 0 }, pointerEvents: { xs: state.selection.sectionId === section.id && !state.selection.blockId ? 'auto' : 'none', md: 'none' }, transition: 'opacity 120ms' }}>
            {(() => {
              const action = (label: string, icon: React.ReactElement, onClick: () => void, disabled = false) => <Tooltip title={label}><span><IconButton size="small" aria-label={label} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }}>{icon}</IconButton></span></Tooltip>;
              return <>
                {state.selection.sectionId === section.id && !state.selection.blockId ? action(publicPageText(locale, 'clearSelection'), <Close fontSize="small" />, () => dispatch({ type: 'selection/clear' })) : null}
                {action(publicPageText(locale, 'moveUp'), <ArrowUpward fontSize="small" />, () => dispatch({ type: 'section/reorder', sectionId: section.id, toIndex: sectionIndex - 1 }), sectionIndex === 0)}
                {action(publicPageText(locale, 'moveDown'), <ArrowDownward fontSize="small" />, () => dispatch({ type: 'section/reorder', sectionId: section.id, toIndex: sectionIndex + 1 }), sectionIndex === state.document.sections.length - 1)}
                {action(publicPageText(locale, section.visible ? 'hide' : 'show'), section.visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />, () => dispatch({ type: 'section/toggle', sectionId: section.id }))}
                {action(publicPageText(locale, 'duplicate'), <ContentCopyOutlined fontSize="small" />, () => dispatch({ type: 'section/add', index: sectionIndex + 1, section: { ...structuredClone(section), id: createStableId(), blocks: section.blocks.map(cloneBlock) } }), !canDuplicateBlocks(section.blocks))}
                {action(publicPageText(locale, 'remove'), <DeleteOutlined fontSize="small" />, () => { if (window.confirm(publicPageText(locale, 'deleteSectionConfirm'))) { dispatch({ type: 'section/remove', sectionId: section.id }); } })}
              </>;
            })()}
          </Stack>,
          renderBlockActions: (section, blockIndex) => {
            const block = section.blocks[blockIndex];
            const action = (label: string, icon: React.ReactElement, onClick: () => void, disabled = false) => <Tooltip title={label}><span><IconButton size="small" aria-label={label} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }}>{icon}</IconButton></span></Tooltip>;
            return <Stack className="public-page-block-actions" direction="row" sx={{ position: 'absolute', zIndex: 3, top: 6, right: 6, p: 0.25, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 3, opacity: { xs: state.selection.blockId === block.id ? 1 : 0, md: 0 }, pointerEvents: { xs: state.selection.blockId === block.id ? 'auto' : 'none', md: 'none' }, transition: 'opacity 120ms' }}>
              {action(publicPageText(locale, 'edit'), <EditOutlined fontSize="small" />, () => { dispatch({ type: 'selection/set', sectionId: section.id, blockId: block.id }); setBlockEditorOpen(true); })}
              {action(publicPageText(locale, 'moveUp'), <ArrowUpward fontSize="small" />, () => dispatch({ type: 'block/reorder', sectionId: section.id, blockId: block.id, toIndex: blockIndex - 1 }), blockIndex === 0)}
              {action(publicPageText(locale, 'moveDown'), <ArrowDownward fontSize="small" />, () => dispatch({ type: 'block/reorder', sectionId: section.id, blockId: block.id, toIndex: blockIndex + 1 }), blockIndex === section.blocks.length - 1)}
              {action(publicPageText(locale, block.visible ? 'hide' : 'show'), block.visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />, () => dispatch({ type: 'block/toggle', sectionId: section.id, blockId: block.id }))}
              {action(publicPageText(locale, 'duplicate'), <ContentCopyOutlined fontSize="small" />, () => dispatch({ type: 'block/add', sectionId: section.id, block: cloneBlock(block), index: blockIndex + 1 }), !canDuplicateBlocks([block]))}
              {action(publicPageText(locale, 'remove'), <DeleteOutlined fontSize="small" />, () => { if (window.confirm(publicPageText(locale, 'deleteBlockConfirm'))) { dispatch({ type: 'block/remove', sectionId: section.id, blockId: block.id }); } })}
            </Stack>;
          },
          renderSectionDragHandle: (section, _sectionIndex, activator) => <Tooltip title={publicPageText(locale, 'drag')}><IconButton {...(activator ?? {})} aria-label={`${publicPageText(locale, 'drag')}: ${section.name}`}
            className="public-page-section-drag-rail" data-public-page-section-drag-rail
            sx={{ position: 'absolute', zIndex: 5, top: 0, left: '50%', transform: 'translate(-50%, -50%)', width: 48, height: 24, borderRadius: 1, bgcolor: 'grey.300', color: 'grey.700', opacity: { xs: state.selection.sectionId === section.id ? 1 : 0, md: 0 }, pointerEvents: { xs: state.selection.sectionId === section.id ? 'auto' : 'none', md: 'none' }, transition: 'opacity 120ms', '&:hover': { bgcolor: 'grey.400' } }}>
            <DragIndicator fontSize="small" sx={{ transform: 'rotate(90deg)' }} /></IconButton></Tooltip>,
          renderBlockDragHandle: (section, blockIndex, activator) => {
            const block = section.blocks[blockIndex];
            return <Tooltip title={publicPageText(locale, 'drag')}><IconButton {...(activator ?? {})} aria-label={`${publicPageText(locale, 'drag')}: ${block.name}`}
              className="public-page-block-drag-rail" data-public-page-block-drag-rail
              sx={{ position: 'absolute', zIndex: 5, left: 'calc(-1 * var(--public-page-editor-drag-gutter, 64px) - 35px)', top: '50%', transform: 'translateY(-50%)', width: 36, height: '100%', borderRadius: '2px', bgcolor: 'grey.300', color: 'grey.700', boxShadow: 1, '&:hover, .public-page-dnd-dragging &': { bgcolor: 'grey.400' } }}>
              <DragIndicator fontSize="small" /></IconButton></Tooltip>;
          },
          renderStagedBlockDragHandle: (block, _blockIndex, activator) => <Tooltip title={publicPageText(locale, 'drag')}><IconButton
            {...(activator ?? {})} aria-label={`${publicPageText(locale, 'drag')}: ${block.name}`}
            className="public-page-block-drag-rail" data-public-page-block-drag-rail
            sx={{ position: 'absolute', zIndex: 5, left: 'calc(-1 * var(--public-page-editor-drag-gutter, 64px) + 12px)', top: '50%', transform: 'translateY(-50%)', width: 36, height: 48, borderRadius: 1.5, bgcolor: 'grey.300', color: 'grey.700', boxShadow: 1, '&:hover, .public-page-dnd-dragging &': { bgcolor: 'grey.400' } }}>
            <DragIndicator fontSize="small" /></IconButton></Tooltip>,
          renderStagedBlockActions: (block) => <Stack className="public-page-block-actions" direction="row"
            sx={{ position: 'absolute', zIndex: 3, top: 6, right: 6, p: 0.25, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 3 }}>
            <Tooltip title={publicPageText(locale, 'remove')}><IconButton size="small" aria-label={publicPageText(locale, 'remove')}
              onClick={() => setStagedBlocks((current) => current.filter((candidate) => candidate.id !== block.id))}>
              <DeleteOutlined fontSize="small" />
            </IconButton></Tooltip>
          </Stack>,
        }} />
        <Button variant="contained" size="large" onClick={() => setAddBlockOpen(true)} sx={{ position: 'sticky', bottom: 20, left: 'calc(50% + 32px)', transform: 'translateX(-50%)', mt: -8, zIndex: 4, minWidth: 180, '&:hover': { transform: 'translateX(-50%) translateY(-1px)' } }}>{publicPageText(locale, 'addBlock')}</Button>
      </Box>}
    />
    <AddBlockDialog open={addBlockOpen} locale={locale} usedPlatforms={usedSocialPlatforms} onClose={() => setAddBlockOpen(false)} onConfirm={addBlock} />
    <BlockEditorDialog open={blockEditorOpen} locale={locale}
      block={state.document.sections.find((section) => section.id === state.selection.sectionId)?.blocks.find((block) => block.id === state.selection.blockId) ?? null}
      sections={state.document.sections} sectionId={state.selection.sectionId ?? undefined}
      repository={repository} media={state.document.media} previewUrls={mediaUrls}
      onPreview={setBlockPreview}
      onClose={() => { setBlockPreview(null); setBlockEditorOpen(false); }} onSave={({ block, sectionId, section, addedMedia, updatedMedia, removedMediaIds }) => {
        const sourceSectionId = state.selection.sectionId;
        if (!sourceSectionId || !sectionId) {return;}
        addedMedia.forEach(({ media, objectUrl }) => { dispatch({ type: 'media/add', media }); rememberMediaPreview(media, objectUrl); });
        updatedMedia.forEach((media) => dispatch({ type: 'media/add', media }));
        const sectionChanges = section
          ? { name: section.name, visible: section.visible, layout: section.layout, design: section.design }
          : undefined;
        dispatch({ type: 'block/move-or-detach', fromSectionId: sourceSectionId, toSectionId: sectionId, block, sectionChanges });
        removedMediaIds.forEach((mediaId) => dispatch({ type: 'media/remove', mediaId }));
        setBlockPreview(null); setBlockEditorOpen(false);
      }} />
    <Dialog open={pageSettingsOpen} onClose={() => setPageSettingsOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{publicPageText(locale, 'pageSettings')}</DialogTitle>
      <DialogContent dividers><InspectorPanel state={state} locale={locale} dispatch={dispatch} repository={repository}
        previewUrls={mediaUrls} onMediaPreview={rememberMediaPreview} /></DialogContent>
    </Dialog>
    <Dialog open={designOpen} onClose={() => setDesignOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle>{publicPageText(locale, 'design')}</DialogTitle>
      <DialogContent dividers sx={{ p: 0, overflow: { xs: 'auto', lg: 'hidden' } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 430px) minmax(0, 1fr)' },
          height: { lg: 'min(760px, calc(100vh - 160px))' }, minHeight: 0 }}>
          <Box sx={{ height: { xs: 480, lg: '100%' }, minWidth: 0, minHeight: 0, borderBottom: { xs: 1, lg: 0 },
            borderRight: { lg: 1 }, borderColor: 'divider' }}>
            <ResponsivePreview document={state.document} device="mobile" mediaUrls={mediaUrls} framed interactive={false}
              ariaLabel={publicPageText(locale, 'preview')} />
          </Box>
          <Box sx={{ minWidth: 0, minHeight: 0, overflow: { xs: 'visible', lg: 'auto' }, p: { xs: 2, sm: 3 } }}>
            <DesignPanel state={state} locale={locale} dispatch={dispatch} repository={repository}
              previewUrls={mediaUrls} onMediaPreview={rememberMediaPreview} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
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
