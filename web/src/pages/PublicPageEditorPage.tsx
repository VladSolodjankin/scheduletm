import Add from '@mui/icons-material/Add';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import Close from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DragIndicator from '@mui/icons-material/DragIndicator';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Height from '@mui/icons-material/Height';
import OpenInNew from '@mui/icons-material/OpenInNew';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import Settings from '@mui/icons-material/Settings';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Snackbar, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddBlockDialog } from '../components/public-page-builder/AddBlockDialog';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import { BlockArchiveDialog } from '../components/public-page-builder/BlockArchiveDialog';
import { BlockEditorDialog, type BlockEditorFocusRequest, type BlockEditorPreview, type BlockEditorSave } from '../components/public-page-builder/BlockEditorDialog';
import { BuilderShell } from '../components/public-page-builder/BuilderShell';
import { BuilderToolbar } from '../components/public-page-builder/BuilderToolbar';
import { EditorNavigationGuard } from '../components/public-page-builder/EditorNavigationGuard';
import { publishIssueText } from '../components/public-page-builder/publishIssueText';
import { DeviceSwitcher, type PreviewDevice } from '../components/public-page-builder/DeviceSwitcher';
import { InspectorPanel } from '../components/public-page-builder/InspectorPanel';
import { DesignPanel } from '../components/public-page-builder/DesignPanel';
import { PUBLIC_PAGE_PREVIEW_GEOMETRY, ResponsivePreview } from '../components/public-page-builder/ResponsivePreview';
import { type BuilderDragPayload, type BuilderDropDestination } from '../components/public-page-builder/BuilderSortable';
import { publicPageText } from '../components/public-page-builder/uiText';
import { createBlankPublicPageDocument } from '../components/public-page-builder/createBlankDocument';
import { usePublicPageEditor } from '../features/public-page-builder/hooks/usePublicPageEditor';
import { selectCanRedo, selectCanUndo } from '../features/public-page-builder/model/selectors';
import { canDeleteMediaFromDocuments, collectReferencedMediaIds } from '../features/public-page-builder/model/media';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import { PublicPageRepositoryError, type PublicPageRecord } from '../features/public-page-builder/repository/PublicPageRepository';
import type { MediaReference, PageBlock, PageSection } from '../features/public-page-builder/types/publicPage';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../features/public-page-builder/model/socialPlatforms';
import { createStableId } from '../features/public-page-builder/utils/createStableId';
import { createEmptyPageSection } from '../features/public-page-builder/model/normalizeDocument';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { servicesApi } from '../shared/api/client';
import type { ServicesResponse } from '../components/services/types';
import { catalogServicesForPreview } from '../features/public-page-builder/model/services';
import { archiveRestoreConflict, resizeSectionMembership } from '../features/public-page-builder/model/editorReducer';
import { normalizeSlug } from '../features/public-page-builder/model/slug';
import { resolvePublishIssueFocusTarget, type PublishIssueFocusTarget } from '../features/public-page-builder/model/publishValidation';
import type { EditorAction } from '../features/public-page-builder/types/actions';
import { publicPageDisplayUrl, publicPageUrl } from '../features/public-page-builder/config/publicPageUrl';

function cloneBlock(block: PageBlock): PageBlock {
  return { ...structuredClone(block), id: createStableId() };
}

function canDuplicateBlocks(blocks: readonly PageBlock[]): boolean {
  return !blocks.some((block) => block.type === 'social-button');
}

type SectionResizePreview = { sectionId: string; targetBlockCount: number };
type SectionResizeGesture = { cancel: () => void };
type ReorderDirection = -1 | 1;
type ReorderTarget =
  | { type: 'section'; sectionId: string }
  | { type: 'block'; sectionId: string; blockId: string };
type ReorderResolution =
  | { status: 'missing' }
  | { status: 'boundary'; edge: 'start' | 'end'; name: string }
  | { status: 'moved'; action: Extract<EditorAction, { type: 'section/reorder' | 'block/reorder' }>; name: string; position: number; total: number };

export function resolveEditorReorder(
  sections: readonly PageSection[],
  target: ReorderTarget,
  direction: ReorderDirection,
): ReorderResolution {
  if (target.type === 'section') {
    const index = sections.findIndex((section) => section.id === target.sectionId);
    if (index < 0) {return { status: 'missing' };}
    const toIndex = index + direction;
    const section = sections[index];
    if (toIndex < 0 || toIndex >= sections.length) {
      return { status: 'boundary', edge: direction < 0 ? 'start' : 'end', name: section.name };
    }
    return {
      status: 'moved',
      action: { type: 'section/reorder', sectionId: section.id, toIndex },
      name: section.name,
      position: toIndex + 1,
      total: sections.length,
    };
  }
  const section = sections.find((candidate) => candidate.id === target.sectionId);
  const index = section?.blocks.findIndex((block) => block.id === target.blockId) ?? -1;
  if (!section || index < 0) {return { status: 'missing' };}
  const toIndex = index + direction;
  const block = section.blocks[index];
  if (toIndex < 0 || toIndex >= section.blocks.length) {
    return { status: 'boundary', edge: direction < 0 ? 'start' : 'end', name: block.name };
  }
  return {
    status: 'moved',
    action: { type: 'block/reorder', sectionId: section.id, blockId: block.id, toIndex },
    name: block.name,
    position: toIndex + 1,
    total: section.blocks.length,
  };
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function focusMarkedControl(root: ParentNode, marker: string): boolean {
  const marked = root.querySelector<HTMLElement>(`[data-public-page-focus="${CSS.escape(marker)}"]`);
  if (!marked) {return false;}
  const focusableSelector = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const target = marked.matches(focusableSelector) ? marked : marked.querySelector<HTMLElement>(focusableSelector) ?? marked;
  target.focus();
  return document.activeElement === target;
}

function sectionResizeMaximum(sections: readonly PageSection[], sectionIndex: number): number {
  let maximum = sections[sectionIndex]?.blocks.length ?? 0;
  for (let index = sectionIndex + 1; index < sections.length; index += 1) {
    if (sections[index].design.variant !== 'off') {break;}
    maximum += sections[index].blocks.length;
  }
  return maximum;
}

function Editor({
  record,
  repository,
  serviceCatalog,
  servicesLoading,
  servicesError,
  onRefreshServices,
}: {
  record: PublicPageRecord;
  repository: ApiPublicPageRepository;
  serviceCatalog: ServicesResponse | null;
  servicesLoading: boolean;
  servicesError: boolean;
  onRefreshServices: () => void;
}) {
  const { locale } = useI18n();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const pageSettingsTitleId = useId();
  const designTitleId = useId();
  const editor = usePublicPageEditor({
    document: record.draft,
    revision: record.revision,
    repository,
    publishedSlug: record.published?.slug ?? null,
  });
  const { state, dispatch } = editor;
  const canonicalSlug = normalizeSlug(state.document.slug);
  const isSlugUnavailable = editor.slugAvailability.status === 'unavailable'
    && editor.slugAvailability.slug === canonicalSlug;
  const publishedSlugChanged = editor.publishedSlug !== null
    && canonicalSlug !== editor.publishedSlug;
  const [device, setDevice] = useState<PreviewDevice>(() => isCompact ? 'mobile' : 'desktop');
  const effectiveDevice: PreviewDevice = isCompact ? 'mobile' : device;
  const [copied, setCopied] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [blockPreview, setBlockPreview] = useState<BlockEditorPreview | null>(null);
  const [sectionResizePreview, setSectionResizePreview] = useState<SectionResizePreview | null>(null);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pageSettingsBusy, setPageSettingsBusy] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designBusy, setDesignBusy] = useState(false);
  const [pageSettingsFocusMarker, setPageSettingsFocusMarker] = useState<string | null>(null);
  const [designPanelFocusMarker, setDesignPanelFocusMarker] = useState<string | null>(null);
  const [blockEditorFocusRequest, setBlockEditorFocusRequest] = useState<BlockEditorFocusRequest | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState({ nonce: 0, message: '' });
  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());
  const mediaUrlsRef = useRef(mediaUrls);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const addBlockButtonRef = useRef<HTMLButtonElement>(null);
  const pageSettingsContentRef = useRef<HTMLDivElement>(null);
  const designContentRef = useRef<HTMLDivElement>(null);
  const validationAlertRef = useRef<HTMLDivElement>(null);
  const reorderFocusRef = useRef<ReorderTarget | null>(null);
  const focusRequestIdRef = useRef(0);
  const sectionResizeGestureRef = useRef<SectionResizeGesture | null>(null);
  const pendingScrollBlockIdRef = useRef<string | null>(null);
  const previewServices = useMemo(() => catalogServicesForPreview(serviceCatalog), [serviceCatalog]);
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
    if (sectionResizePreview) {
      document = resizeSectionMembership(document, sectionResizePreview.sectionId, sectionResizePreview.targetBlockCount);
    }
    return document;
  }, [blockPreview, sectionResizePreview, state.document, state.selection.sectionId]);
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
  useEffect(() => () => sectionResizeGestureRef.current?.cancel(), []);
  const rememberMediaPreview = (media: MediaReference, url: string) => {
    setMediaUrls((current) => {
      const old = current.get(media.id); if (old && old !== url) {URL.revokeObjectURL(old);}
      return new Map(current).set(media.id, url);
    });
  };

  const addBlock = ({ block, addedMedia, updatedMedia, removedMediaIds }: BlockEditorSave) => {
    const mediaChanges = { upsert: [...addedMedia.map(({ media }) => media), ...updatedMedia], removeIds: removedMediaIds };
    const targetSection = state.document.sections[state.document.sections.length - 1];
    pendingScrollBlockIdRef.current = block.id;
    if (targetSection) {
      dispatch({ type: 'block/add', sectionId: targetSection.id, block, index: targetSection.blocks.length, mediaChanges });
      dispatch({ type: 'selection/set', sectionId: targetSection.id, blockId: block.id });
    } else {
      const section = createEmptyPageSection('off');
      section.blocks = [block];
      dispatch({ type: 'block/create-with-section', section, mediaChanges });
    }
    addedMedia.forEach(({ media, objectUrl }) => rememberMediaPreview(media, objectUrl));
  };
  useLayoutEffect(() => {
    const blockId = pendingScrollBlockIdRef.current;
    if (!blockId) {return;}
    const target = previewRootRef.current?.querySelector<HTMLElement>(`[data-editor-block-id="${CSS.escape(blockId)}"]`);
    if (!target) {return;}
    pendingScrollBlockIdRef.current = null;
    const frame = window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, [state.document.sections]);
  useLayoutEffect(() => {
    const pending = reorderFocusRef.current;
    if (!pending) {return;}
    reorderFocusRef.current = null;
    const selector = pending.type === 'section'
      ? `[data-public-page-section-drag-rail="${CSS.escape(pending.sectionId)}"]`
      : `[data-public-page-block-drag-rail="${CSS.escape(pending.blockId)}"]`;
    const target = previewRootRef.current?.querySelector<HTMLElement>(selector) ?? addBlockButtonRef.current;
    const frame = window.requestAnimationFrame(() => target?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [state.document.sections]);
  const removeDetachedMedia = (candidateIds: readonly string[], retainedValues: readonly unknown[]) => {
    const retainedIds = new Set(collectReferencedMediaIds(retainedValues));
    candidateIds.filter((mediaId) => !retainedIds.has(mediaId))
      .forEach((mediaId) => dispatch({ type: 'media/remove', mediaId }));
  };
  const removeSection = (section: PageSection) => {
    const mediaIds = collectReferencedMediaIds(section);
    dispatch({ type: 'section/remove', sectionId: section.id });
    removeDetachedMedia(mediaIds, [state.document.profile, state.document.theme, state.document.seo,
      state.document.sections.filter((candidate) => candidate.id !== section.id)]);
  };
  const removeBlock = (section: PageSection, block: PageBlock) => {
    dispatch({ type: 'block/remove', sectionId: section.id, blockId: block.id });
    removeDetachedMedia(collectReferencedMediaIds(block), [state.document.profile, state.document.theme, state.document.seo,
      state.document.sections.map((candidate) => candidate.id === section.id
        ? { ...candidate, blocks: candidate.blocks.filter((item) => item.id !== block.id) }
        : candidate)]);
  };
  const usedSocialPlatforms = useMemo(() => new Set(state.document.sections.flatMap((section) => section.blocks)
    .filter((block) => block.type === 'social-button' && SOCIAL_PLATFORMS.includes(block.content.platform as SocialPlatform))
    .map((block) => block.content.platform as SocialPlatform)), [state.document.sections]);
  const copyLink = async () => {
    if (!editor.publishedSlug) {return;}
    await navigator.clipboard.writeText(publicPageUrl(editor.publishedSlug));
    setCopied(true);
  };
  const focusValidationAlert = useCallback(() => {
    window.setTimeout(() => validationAlertRef.current?.focus(), 250);
  }, []);
  const closeCompetingDialogs = useCallback(() => {
    setAddBlockOpen(false);
    setBlockEditorOpen(false);
    setPageSettingsOpen(false);
    setDesignOpen(false);
    setBlockPreview(null);
    setPageSettingsFocusMarker(null);
    setDesignPanelFocusMarker(null);
    setBlockEditorFocusRequest(null);
  }, []);
  const focusPublishTarget = useCallback((target: PublishIssueFocusTarget) => {
    closeCompetingDialogs();
    if (target.type === 'validation-alert') {
      focusValidationAlert();
      return;
    }
    if (target.type === 'add-block') {
      window.requestAnimationFrame(() => {
        const button = addBlockButtonRef.current;
        if (button) {button.focus();}
        else {focusValidationAlert();}
      });
      return;
    }
    if (target.type === 'page-settings') {
      dispatch({ type: 'selection/clear' });
      setPageSettingsFocusMarker(target.marker);
      window.requestAnimationFrame(() => setPageSettingsOpen(true));
      return;
    }
    if (target.type === 'design-panel') {
      dispatch({ type: 'selection/clear' });
      setDesignPanelFocusMarker(target.marker);
      window.requestAnimationFrame(() => setDesignOpen(true));
      return;
    }

    dispatch({ type: 'selection/set', sectionId: target.sectionId, blockId: target.blockId });
    window.requestAnimationFrame(() => {
      const blockElement = previewRootRef.current?.querySelector<HTMLElement>(
        `[data-editor-block-id="${CSS.escape(target.blockId)}"]`,
      );
      if (!blockElement) {
        focusValidationAlert();
        return;
      }
      blockElement.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
      setBlockEditorFocusRequest({
        requestId: ++focusRequestIdRef.current,
        tab: target.tab,
        marker: target.marker,
      });
      setBlockEditorOpen(true);
    });
  }, [closeCompetingDialogs, dispatch, focusValidationAlert]);
  const handlePublish = useCallback(async () => {
    const issues = await editor.publish();
    const firstIssue = issues[0];
    if (firstIssue) {
      focusPublishTarget(resolvePublishIssueFocusTarget(state.document, firstIssue));
    }
  }, [editor, focusPublishTarget, state.document]);
  const reorderEditorItem = useCallback((target: ReorderTarget, direction: ReorderDirection) => {
    const resolution = resolveEditorReorder(state.document.sections, target, direction);
    if (resolution.status === 'missing') {return;}
    if (resolution.status === 'boundary') {
      const message = interpolate(publicPageText(locale, resolution.edge === 'start' ? 'reorderAtStart' : 'reorderAtEnd'), {
        name: resolution.name,
      });
      setReorderAnnouncement((current) => ({ nonce: current.nonce + 1, message }));
      return;
    }
    reorderFocusRef.current = target;
    dispatch(resolution.action);
    const message = interpolate(publicPageText(locale, target.type === 'section' ? 'sectionMovedAnnouncement' : 'blockMovedAnnouncement'), {
      name: resolution.name,
      position: resolution.position,
      total: resolution.total,
    });
    setReorderAnnouncement((current) => ({ nonce: current.nonce + 1, message }));
  }, [dispatch, locale, state.document.sections]);
  const onDropItem = (payload: BuilderDragPayload, destination: BuilderDropDestination) => {
    if (payload.type === 'section') {
      if (destination.type !== 'main') {return;}
      dispatch({ type: 'layout/drop', item: payload, to: destination });
      return;
    }
    dispatch({
      type: 'layout/drop',
      item: { type: 'block', blockId: payload.blockId },
      to: destination,
    });
  };
  const beginSectionResize = (section: PageSection, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || sectionResizeGestureRef.current) {return;}
    const sectionIndex = previewDocument.sections.findIndex((candidate) => candidate.id === section.id);
    const previewSection = previewDocument.sections[sectionIndex];
    if (!previewSection || previewSection.design.variant === 'off' || previewSection.blocks.length < 1) {return;}
    const candidateBlockIds: string[] = [];
    for (let index = sectionIndex; index < previewDocument.sections.length; index += 1) {
      const candidateSection = previewDocument.sections[index];
      if (index > sectionIndex && candidateSection.design.variant !== 'off') {break;}
      candidateBlockIds.push(...candidateSection.blocks.map((block) => block.id));
    }
    const previewScroller = previewRootRef.current?.querySelector<HTMLElement>('[data-public-page-preview-scroller]');
    if (!previewScroller) {return;}

    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    const startBlockCount = previewSection.blocks.length;
    let targetBlockCount = startBlockCount;
    let latestClientY = event.clientY;
    let autoScrollFrame: number | null = null;
    let active = true;
    const countAt = (clientY: number) => {
      const midpoints = candidateBlockIds.map((blockId) => {
        const element = previewRootRef.current?.querySelector<HTMLElement>(`[data-editor-block-id="${CSS.escape(blockId)}"]`);
        if (!element) {return null;}
        const bounds = element.getBoundingClientRect();
        return bounds.top + bounds.height / 2;
      });
      if (midpoints.some((midpoint) => midpoint === null)) {return targetBlockCount;}
      return Math.max(1, midpoints.filter((midpoint) => midpoint !== null && midpoint <= clientY).length);
    };
    const updateTargetCount = () => {
      const nextCount = countAt(latestClientY);
      if (nextCount === targetBlockCount) {return;}
      targetBlockCount = nextCount;
      setSectionResizePreview({ sectionId: previewSection.id, targetBlockCount: nextCount });
    };
    const runAutoScroll = () => {
      if (!active) {return;}
      const bounds = previewScroller.getBoundingClientRect();
      const edgeSize = 56;
      const topDistance = latestClientY - bounds.top;
      const bottomDistance = bounds.bottom - latestClientY;
      const scrollDelta = topDistance < edgeSize
        ? -Math.ceil(14 * (edgeSize - Math.max(0, topDistance)) / edgeSize)
        : bottomDistance < edgeSize
          ? Math.ceil(14 * (edgeSize - Math.max(0, bottomDistance)) / edgeSize)
          : 0;
      if (scrollDelta !== 0) {
        previewScroller.scrollTop += scrollDelta;
        updateTargetCount();
      }
      autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
    };
    const cleanup = () => {
      if (!active) {return;}
      active = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onCancel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
      try {
        if (handle.hasPointerCapture(pointerId)) {handle.releasePointerCapture(pointerId);}
      } catch { /* The handle may already be detached during preview reconciliation. */ }
      sectionResizeGestureRef.current = null;
      setSectionResizePreview(null);
    };
    const onPointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {return;}
      latestClientY = pointerEvent.clientY;
      updateTargetCount();
    };
    const onPointerUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {return;}
      targetBlockCount = countAt(pointerEvent.clientY);
      cleanup();
      if (targetBlockCount !== startBlockCount) {
        dispatch({ type: 'section/resize-membership', sectionId: previewSection.id, targetBlockCount });
      }
    };
    const onPointerCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === pointerId) {cleanup();}
    };
    const onCancel = () => cleanup();
    const onVisibilityChange = () => {if (document.hidden) {cleanup();}};
    sectionResizeGestureRef.current = { cancel: cleanup };
    setSectionResizePreview({ sectionId: previewSection.id, targetBlockCount: startBlockCount });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onCancel);
    document.addEventListener('visibilitychange', onVisibilityChange);
    handle.setPointerCapture(pointerId);
    autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
  };

  return (
    <>
    <EditorNavigationGuard locale={locale} dirty={state.dirty} busy={state.saveStatus === 'saving' || editor.isPublishing} save={editor.save} />
    <BuilderShell
      toolbar={
        <Stack spacing={1}>
            <BuilderToolbar
              locale={locale}
              compact={isCompact}
              title={publicPageText(locale, 'editorWorkspaceTitle')}
              saveStatus={state.saveStatus}
              dirty={state.dirty}
              isPublishing={editor.isPublishing}
              canUndo={selectCanUndo(state)}
              canRedo={selectCanRedo(state)}
              hasPublishErrors={state.publishErrors.length > 0}
              isSlugUnavailable={isSlugUnavailable}
              onSave={() => void editor.save()}
              onUndo={() => dispatch({ type: 'history/undo' })}
              onRedo={() => dispatch({ type: 'history/redo' })}
              onPublish={() => void handlePublish()}
              pageActions={<Stack component="nav" aria-label={publicPageText(locale, 'mobileNavigation')} direction="row" spacing={0} sx={{ alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                <Stack direction="row" spacing={isCompact ? 0 : 1} sx={{ alignItems: 'center', minWidth: 0 }}>
                  {isCompact ? (
                    <>
                      <Tooltip title={publicPageText(locale, 'pageSettings')}><IconButton aria-label={publicPageText(locale, 'pageSettings')} onClick={() => { dispatch({ type: 'selection/clear' }); setPageSettingsFocusMarker(null); setPageSettingsOpen(true); }} sx={{ width: 40, height: 40 }}><Settings fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title={publicPageText(locale, 'design')}><IconButton aria-label={publicPageText(locale, 'design')} onClick={() => { dispatch({ type: 'selection/clear' }); setDesignPanelFocusMarker(null); setDesignOpen(true); }} sx={{ width: 40, height: 40 }}><PaletteOutlined fontSize="small" /></IconButton></Tooltip>
                    </>
                  ) : (
                    <>
                      <Button variant="outlined" startIcon={<Settings />} onClick={() => { dispatch({ type: 'selection/clear' }); setPageSettingsFocusMarker(null); setPageSettingsOpen(true); }}>{publicPageText(locale, 'pageSettings')}</Button>
                      <Button variant="outlined" startIcon={<PaletteOutlined />} onClick={() => { dispatch({ type: 'selection/clear' }); setDesignPanelFocusMarker(null); setDesignOpen(true); }}>{publicPageText(locale, 'design')}</Button>
                    </>
                  )}
                  {editor.publishedSlug ? (
                    <>
                      <Tooltip title={publicPageText(locale, 'copyLink')}><IconButton aria-label={publicPageText(locale, 'copyLink')} onClick={() => void copyLink()} sx={isCompact ? { width: 40, height: 40 } : undefined}><ContentCopy fontSize={isCompact ? 'small' : 'medium'} /></IconButton></Tooltip>
                      <Tooltip title={publicPageText(locale, 'open')}><IconButton aria-label={publicPageText(locale, 'open')} href={publicPageUrl(editor.publishedSlug)} target="_blank" rel="noopener noreferrer" sx={isCompact ? { width: 40, height: 40 } : undefined}><OpenInNew fontSize={isCompact ? 'small' : 'medium'} /></IconButton></Tooltip>
                    </>
                  ) : null}
                </Stack>
                <DeviceSwitcher compact={isCompact} locale={locale} value={effectiveDevice} onChange={setDevice} />
              </Stack>}
            />
          {editor.hasConflict ? (
            <Alert severity="error" action={<Button onClick={() => void editor.reloadLatest()}>{publicPageText(locale, 'reloadLatest')}</Button>}>
              {publicPageText(locale, 'revisionConflict')}
            </Alert>
          ) : state.saveStatus === 'error' ? (
            <Alert severity="error" action={<Button disabled={isSlugUnavailable} onClick={() => void editor.save()}>{publicPageText(locale, 'retry')}</Button>}>
              {publicPageText(locale, state.saveError === 'revision_conflict'
                ? 'revisionConflict'
                : state.saveError === 'slug_conflict'
                  ? 'slugConflict'
                  : 'saveError')}
            </Alert>
          ) : null}
          {publishedSlugChanged && editor.publishedSlug ? (
            <Alert severity="info">
              {publicPageText(locale, 'publishedSlugChangeWarning').replace('{url}', publicPageDisplayUrl(editor.publishedSlug))}
            </Alert>
          ) : null}
          {editor.publishIssues.length > 0 ? (
            <Alert ref={validationAlertRef} tabIndex={-1} severity="warning" data-public-page-validation-alert>
              {publicPageText(locale, 'validation')}
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {editor.publishIssues.map((issue, index) => (
                  <li key={`${issue.path}-${issue.code}-${index}`}>
                    {publishIssueText(locale, issue)}
                  </li>
                ))}
              </Box>
            </Alert>
          ) : null}
        </Stack>
      }
      preview={<Box ref={previewRootRef} sx={{ height: '100%', minHeight: 0, position: 'relative' }}>
        <ResponsivePreview document={previewDocument} device={effectiveDevice} mediaUrls={previewMediaUrls} services={previewServices} compactEditor={isCompact}
          ariaLabel={publicPageText(locale, 'preview')} editor={{
          onDropItem,
          scheduleStatusLabel: (visible) => publicPageText(locale, visible ? 'scheduleActive' : 'scheduleInactive'),
          selectedBlockId: state.selection.blockId,
          blockAriaLabel: (name) => publicPageText(locale, 'blockEditorLabel').replace('{name}', name),
          onSelectBlock: (sectionId, blockId) => {
            setBlockEditorFocusRequest(null);
            dispatch({ type: 'selection/set', sectionId, blockId });
            setBlockEditorOpen(true);
          },
          renderSectionActions: (section, sectionIndex) => <Stack className="public-page-section-actions" direction="row" sx={{ position: 'absolute', zIndex: 4, top: 0, left: 8, transform: 'translateY(-100%)', p: 0.25, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 3, opacity: { xs: state.selection.sectionId === section.id && !state.selection.blockId ? 1 : 0, md: 0 }, pointerEvents: { xs: state.selection.sectionId === section.id && !state.selection.blockId ? 'auto' : 'none', md: 'none' }, transition: 'opacity 120ms' }}>
            {(() => {
              const action = (label: string, icon: React.ReactElement, onClick: () => void, disabled = false) => <Tooltip title={label}><span><IconButton size="small" aria-label={label} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }}>{icon}</IconButton></span></Tooltip>;
              return <>
                {state.selection.sectionId === section.id && !state.selection.blockId ? action(publicPageText(locale, 'clearSelection'), <Close fontSize="small" />, () => dispatch({ type: 'selection/clear' })) : null}
                {action(publicPageText(locale, 'moveUp'), <ArrowUpward fontSize="small" />, () => reorderEditorItem({ type: 'section', sectionId: section.id }, -1), sectionIndex === 0)}
                {action(publicPageText(locale, 'moveDown'), <ArrowDownward fontSize="small" />, () => reorderEditorItem({ type: 'section', sectionId: section.id }, 1), sectionIndex === state.document.sections.length - 1)}
                {action(publicPageText(locale, section.visible ? 'hide' : 'show'), section.visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />, () => dispatch({ type: 'section/toggle', sectionId: section.id }))}
                {action(publicPageText(locale, 'duplicate'), <ContentCopyOutlined fontSize="small" />, () => dispatch({ type: 'section/add', index: sectionIndex + 1, section: { ...structuredClone(section), id: createStableId(), blocks: section.blocks.map(cloneBlock) } }), !canDuplicateBlocks(section.blocks))}
                {action(publicPageText(locale, 'remove'), <DeleteOutlined fontSize="small" />, () => { if (window.confirm(publicPageText(locale, 'deleteSectionConfirm'))) { removeSection(section); } })}
              </>;
            })()}
          </Stack>,
          renderBlockActions: (section, blockIndex) => {
            const block = section.blocks[blockIndex];
            const action = (label: string, icon: React.ReactElement, onClick: () => void, disabled = false) => <Tooltip title={label}><span><IconButton size="small" aria-label={label} disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }}>{icon}</IconButton></span></Tooltip>;
            return <Stack className="public-page-block-actions" direction="row" sx={{ position: 'absolute', zIndex: 3, top: 6, right: 6, p: 0.25, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 3, opacity: { xs: state.selection.blockId === block.id ? 1 : 0, md: 0 }, pointerEvents: { xs: state.selection.blockId === block.id ? 'auto' : 'none', md: 'none' }, transition: 'opacity 120ms' }}>
              {action(publicPageText(locale, 'edit'), <EditOutlined fontSize="small" />, () => {
                setBlockEditorFocusRequest(null);
                dispatch({ type: 'selection/set', sectionId: section.id, blockId: block.id });
                setBlockEditorOpen(true);
              })}
              {action(publicPageText(locale, 'moveUp'), <ArrowUpward fontSize="small" />, () => reorderEditorItem({ type: 'block', sectionId: section.id, blockId: block.id }, -1), blockIndex === 0)}
              {action(publicPageText(locale, 'moveDown'), <ArrowDownward fontSize="small" />, () => reorderEditorItem({ type: 'block', sectionId: section.id, blockId: block.id }, 1), blockIndex === section.blocks.length - 1)}
              {action(publicPageText(locale, block.visible ? 'hide' : 'show'), block.visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />, () => dispatch({ type: 'block/toggle', sectionId: section.id, blockId: block.id }))}
              {action(publicPageText(locale, 'duplicate'), <ContentCopyOutlined fontSize="small" />, () => dispatch({ type: 'block/add', sectionId: section.id, block: cloneBlock(block), index: blockIndex + 1 }), !canDuplicateBlocks([block]))}
              {action(publicPageText(locale, 'archiveBlock'), <ArchiveOutlined fontSize="small" />, () => dispatch({ type: 'block/archive', sectionId: section.id, blockId: block.id }))}
              {action(publicPageText(locale, 'remove'), <DeleteOutlined fontSize="small" />, () => { if (window.confirm(publicPageText(locale, 'deleteBlockConfirm'))) { removeBlock(section, block); } })}
            </Stack>;
          },
          renderSectionDragHandle: (section, sectionIndex, activator) => {
            if (section.design.variant === 'off') {return null;}
            const hint = publicPageText(locale, 'reorderKeyboardHint');
            const label = interpolate(publicPageText(locale, 'sectionReorderLabel'), {
              name: section.name, position: sectionIndex + 1, total: state.document.sections.length, hint,
            });
            return <IconButton {...(activator ?? {})} title={publicPageText(locale, 'drag')} aria-label={label} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onKeyDown={(event) => {
                if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
                  activator?.onKeyDown?.(event);
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                reorderEditorItem({ type: 'section', sectionId: section.id }, event.key === 'ArrowUp' ? -1 : 1);
              }}
              className={`public-page-section-drag-rail${state.selection.sectionId === section.id ? ' is-selected' : ''}`} data-public-page-section-drag-rail={section.id}>
              <DragIndicator fontSize="small" /></IconButton>;
          },
          renderSectionResizeHandle: (section, sectionIndex) => {
            const currentBlockCount = section.blocks.length;
            const maximumBlockCount = sectionResizeMaximum(previewDocument.sections, sectionIndex);
            const label = publicPageText(locale, 'resizeSection');
            return <IconButton title={label} aria-label={`${label}: ${section.name}`} role="slider"
              aria-orientation="vertical" aria-valuemin={1} aria-valuemax={maximumBlockCount} aria-valuenow={currentBlockCount}
              className="public-page-section-resize-handle"
              onPointerDown={(event) => beginSectionResize(section, event)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                let targetBlockCount: number;
                switch (event.key) {
                  case 'ArrowUp':
                  case 'ArrowRight':
                    targetBlockCount = currentBlockCount + 1;
                    break;
                  case 'ArrowDown':
                  case 'ArrowLeft':
                    targetBlockCount = currentBlockCount - 1;
                    break;
                  case 'Home':
                    targetBlockCount = 1;
                    break;
                  case 'End':
                    targetBlockCount = maximumBlockCount;
                    break;
                  default:
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                if (targetBlockCount === currentBlockCount) {return;}
                if (targetBlockCount >= 1 && targetBlockCount <= maximumBlockCount) {
                  dispatch({ type: 'section/resize-membership', sectionId: section.id, targetBlockCount });
                }
              }}>
              <Height fontSize="small" />
            </IconButton>;
          },
          renderBlockDragHandle: (section, blockIndex, activator) => {
            const block = section.blocks[blockIndex];
            const hint = publicPageText(locale, 'reorderKeyboardHint');
            const label = interpolate(publicPageText(locale, 'blockReorderLabel'), {
              name: block.name, position: blockIndex + 1, total: section.blocks.length, hint,
            });
            return <IconButton {...(activator ?? {})} title={publicPageText(locale, 'drag')} aria-label={label} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onKeyDown={(event) => {
                if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
                  activator?.onKeyDown?.(event);
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                reorderEditorItem({ type: 'block', sectionId: section.id, blockId: block.id }, event.key === 'ArrowUp' ? -1 : 1);
              }}
              className="public-page-block-drag-rail" data-public-page-block-drag-rail={block.id}
            >
              <DragIndicator fontSize="small" /></IconButton>;
          },
        }}
        />
      </Box>}
      bottomNavigation={<Box data-public-page-add-block-shell sx={{ display: 'flex', width: 'min(13.5rem, calc(100% - 16px))', height: 52, boxSizing: 'border-box', p: 0.5, borderRadius: 2,
        bgcolor: 'grey.900', boxShadow: 6, transform: isCompact ? 'none' : `translateX(${PUBLIC_PAGE_PREVIEW_GEOMETRY.editorDragGutter / 2}px)` }}>
        <Button ref={addBlockButtonRef} variant="contained" size="medium" startIcon={<Add />} onClick={() => setAddBlockOpen(true)} sx={{ width: '100%', minWidth: 0, minHeight: 44 }}>{publicPageText(locale, 'addBlock')}</Button>
      </Box>}
    />
    <Box role="status" aria-live="polite" aria-atomic="true" sx={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>
      <span key={reorderAnnouncement.nonce}>{reorderAnnouncement.message}</span>
    </Box>
    <AddBlockDialog open={addBlockOpen} compact={isCompact} locale={locale} usedPlatforms={usedSocialPlatforms} theme={state.document.theme}
      timezone={state.document.timezone} onOpenArchive={() => setArchiveOpen(true)}
      repository={repository} media={state.document.media} previewUrls={mediaUrls}
      serviceCatalog={serviceCatalog} servicesLoading={servicesLoading} servicesError={servicesError} onRefreshServices={onRefreshServices}
      onClose={() => setAddBlockOpen(false)} onConfirm={addBlock} />
    <BlockEditorDialog open={blockEditorOpen} compact={isCompact} locale={locale}
      block={state.document.sections.find((section) => section.id === state.selection.sectionId)?.blocks.find((block) => block.id === state.selection.blockId) ?? null}
      sections={state.document.sections} sectionId={state.selection.sectionId ?? undefined}
      theme={state.document.theme} timezone={state.document.timezone}
      repository={repository} media={state.document.media} previewUrls={mediaUrls}
      serviceCatalog={serviceCatalog} servicesLoading={servicesLoading} servicesError={servicesError} onRefreshServices={onRefreshServices}
      focusRequest={blockEditorFocusRequest}
      onFocusTargetMissing={() => {
        setBlockPreview(null);
        setBlockEditorFocusRequest(null);
        setBlockEditorOpen(false);
        focusValidationAlert();
      }}
      onPreview={setBlockPreview}
      onRemoveSection={(sectionId) => {
        const section = state.document.sections.find((candidate) => candidate.id === sectionId);
        if (section) {removeSection(section);}
        setBlockPreview(null);
        setBlockEditorOpen(false);
      }}
      onClose={() => { setBlockPreview(null); setBlockEditorFocusRequest(null); setBlockEditorOpen(false); }} onSave={({ block, sectionId, section, addedMedia, updatedMedia, removedMediaIds }) => {
        const sourceSectionId = state.selection.sectionId;
        if (!sourceSectionId || !sectionId) {return;}
        addedMedia.forEach(({ media, objectUrl }) => { dispatch({ type: 'media/add', media }); rememberMediaPreview(media, objectUrl); });
        updatedMedia.forEach((media) => dispatch({ type: 'media/add', media }));
        const sectionChanges = section
          ? { name: section.name, visible: section.visible, layout: section.layout, design: section.design }
          : undefined;
        dispatch({ type: 'block/move-or-detach', fromSectionId: sourceSectionId, toSectionId: sectionId, block, sectionChanges });
        removedMediaIds.forEach((mediaId) => dispatch({ type: 'media/remove', mediaId }));
        setBlockPreview(null); setBlockEditorFocusRequest(null); setBlockEditorOpen(false);
      }} />
    <Dialog open={pageSettingsOpen} aria-labelledby={pageSettingsTitleId} onClose={() => { if (pageSettingsBusy) {return;} setPageSettingsFocusMarker(null); setPageSettingsOpen(false); }} fullScreen={isCompact} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: isCompact ? 0 : 4 } }, transition: { onEntered: () => {
        if (!pageSettingsFocusMarker) {return;}
        window.requestAnimationFrame(() => {
          const content = pageSettingsContentRef.current;
          if (!content || !focusMarkedControl(content, pageSettingsFocusMarker)) {
            setPageSettingsOpen(false);
            focusValidationAlert();
          }
        });
      } } }}>
      <DialogTitle id={`${pageSettingsTitleId}-header`} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 68, px: 3, py: 1.5 }}>
        <Typography id={pageSettingsTitleId} component="span" variant="h6" sx={{ flex: 1 }}>{publicPageText(locale, 'pageSettings')}</Typography>
        <IconButton disabled={pageSettingsBusy} aria-label={publicPageText(locale, 'close')} onClick={() => { setPageSettingsFocusMarker(null); setPageSettingsOpen(false); }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent ref={pageSettingsContentRef} dividers><InspectorPanel state={state} locale={locale} dispatch={dispatch} repository={repository}
        busy={pageSettingsBusy} onBusyChange={setPageSettingsBusy} slugAvailability={editor.slugAvailability} previewUrls={mediaUrls} onMediaPreview={rememberMediaPreview} /></DialogContent>
    </Dialog>
    <Dialog open={designOpen} aria-labelledby={designTitleId} onClose={() => { if (designBusy) {return;} setDesignPanelFocusMarker(null); setDesignOpen(false); }} fullScreen={isCompact} fullWidth maxWidth={false}
      slotProps={{ paper: { sx: { maxWidth: 1664, borderRadius: isCompact ? 0 : 4 } }, transition: { onEntered: () => {
        if (!designPanelFocusMarker) {return;}
        window.requestAnimationFrame(() => {
          const content = designContentRef.current;
          if (!content || !focusMarkedControl(content, designPanelFocusMarker)) {
            setDesignOpen(false);
            focusValidationAlert();
          }
        });
      } } }}>
      <DialogTitle id={`${designTitleId}-header`} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 68, px: 3, py: 1.5 }}>
        <Typography id={designTitleId} component="span" variant="h6" sx={{ flex: 1 }}>{publicPageText(locale, 'design')}</Typography>
        <IconButton disabled={designBusy} aria-label={publicPageText(locale, 'close')} onClick={() => { setDesignPanelFocusMarker(null); setDesignOpen(false); }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent ref={designContentRef} dividers sx={{ p: 0, overflow: { xs: 'auto', lg: 'hidden' } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(360px, 1fr) minmax(0, 2fr)' },
          height: { lg: 'min(760px, calc(100vh - 160px))' }, minHeight: 0 }}>
          <Box sx={{ order: { xs: 1, lg: 0 }, height: { xs: 360, lg: '100%' }, minWidth: 0, minHeight: 0, borderBottom: { xs: 1, lg: 0 },
            borderRight: { lg: 1 }, borderColor: 'divider' }}>
            <ResponsivePreview document={state.document} device="mobile" mediaUrls={mediaUrls} services={previewServices} framed interactive={false}
              ariaLabel={publicPageText(locale, 'preview')} />
          </Box>
          <Box sx={{ order: { xs: 0, lg: 1 }, minWidth: 0, minHeight: 0, overflow: { xs: 'visible', lg: 'auto' }, p: { xs: 2, sm: 3, lg: 4 } }}>
            <DesignPanel key={designPanelFocusMarker ?? 'manual'} state={state} locale={locale} dispatch={dispatch} repository={repository}
              busy={designBusy} onBusyChange={setDesignBusy} focusMarker={designPanelFocusMarker}
              previewUrls={mediaUrls} onMediaPreview={rememberMediaPreview} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
    <BlockArchiveDialog open={archiveOpen} compact={isCompact} document={state.document} locale={locale} onClose={() => setArchiveOpen(false)} onRestore={(blockId) => {
      if (archiveRestoreConflict(state.document, blockId)) {return false;}
      dispatch({ type: 'block/restore', blockId }); return true;
    }} />
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
  const [serviceCatalog, setServiceCatalog] = useState<ServicesResponse | null>(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(false);
  const servicesInFlightRef = useRef<Promise<void> | null>(null);
  const refreshServices = useCallback(() => {
    if (!accessToken) {return Promise.resolve();}
    if (servicesInFlightRef.current) {return servicesInFlightRef.current;}
    setServicesLoading(true);
    setServicesError(false);
    const request = servicesApi.list<ServicesResponse>(accessToken)
      .then(({ data }) => setServiceCatalog(data))
      .catch(() => setServicesError(true))
      .finally(() => {
        servicesInFlightRef.current = null;
        setServicesLoading(false);
      });
    servicesInFlightRef.current = request;
    return request;
  }, [accessToken]);
  useEffect(() => {
    void refreshServices();
    const onFocus = () => {void refreshServices();};
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshServices]);
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
    return <Editor record={record} repository={repository} serviceCatalog={serviceCatalog} servicesLoading={servicesLoading}
      servicesError={servicesError} onRefreshServices={() => {void refreshServices();}} />;
  }, [createNew, load, locale, profileId, record, refreshServices, repository, serviceCatalog, servicesError, servicesLoading, status]);
  return content;
}
