import { Close, DeleteOutlined } from '@mui/icons-material';
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { MediaReference, PageBlock, PageSection, PageTheme } from '../../features/public-page-builder/types/publicPage';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { publicPageText } from './uiText';
import { ImageUploadControl } from './ImageUploadControl';
import { reconcilePendingMediaCleanup } from '../../features/public-page-builder/model/media';
import { applyAvatarCoverColor, isSameAvatarCoverColor, resolveAvatarCoverPalette, resolveSelectedAvatarCoverColor } from './avatarCoverPalette';
import { RichTextEditor } from './RichTextEditor';
import { normalizeRichTextDocument } from '../../features/public-page-builder/model/normalizeDocument';
import { resolvePublicPageThemeVariables } from '../public-page-blocks/publicPageThemeVariables';
import { SectionDesignControls } from './SectionDesignControls';
import { ServicesBlockEditor } from './ServicesBlockEditor';
import type { ServicesResponse } from '../services/types';
import { analyzeBlockContrast } from '../../features/public-page-builder/model/contrast';
import { ContrastGuidance } from './ContrastGuidance';

export type BlockEditorSave = { block: PageBlock; sectionId?: string; section?: PageSection; addedMedia: Array<{ media: MediaReference; objectUrl: string }>; updatedMedia: MediaReference[]; removedMediaIds: string[] };
export type BlockEditorPreview = Pick<BlockEditorSave, 'block' | 'sectionId' | 'section' | 'addedMedia' | 'updatedMedia'>;
export type BlockEditorFocusRequest = {
  requestId: number;
  tab: 'content' | 'design' | 'settings' | 'section';
  marker: string;
};

const BLOCK_EDITOR_TAB_INDEX: Record<BlockEditorFocusRequest['tab'], number> = {
  content: 0,
  design: 1,
  settings: 2,
  section: 3,
};

function focusMarkedEditorControl(marker: string): boolean {
  const marked = document.querySelector<HTMLElement>(`[data-public-page-focus="${CSS.escape(marker)}"]`);
  if (!marked) {return false;}
  const focusableSelector = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const target = marked.matches(focusableSelector) ? marked : marked.querySelector<HTMLElement>(focusableSelector) ?? marked;
  target.focus();
  return document.activeElement === target;
}

function selectAvatarCoverColorWithKeyboard(
  event: KeyboardEvent<HTMLElement>,
  colors: readonly string[],
  color: string,
  select: (color: string) => void,
) {
  const currentIndex = colors.indexOf(color);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? colors.length - 1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (currentIndex + 1) % colors.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (currentIndex - 1 + colors.length) % colors.length
          : null;
  if (nextIndex === null) {return;}
  event.preventDefault();
  select(colors[nextIndex]);
  const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[nextIndex]?.focus();
}

function AvatarCoverPalette({ locale, theme, value, onChange }: {
  locale: Locale;
  theme: PageTheme;
  value: unknown;
  onChange: (color: string) => void;
}) {
  const label = publicPageText(locale, 'cover');
  const selectedColor = resolveSelectedAvatarCoverColor(theme, value);
  const colors = resolveAvatarCoverPalette(theme);

  return <Stack spacing={0.75}>
    <Typography variant="subtitle2" id="avatar-cover-palette-label">{label}</Typography>
    <Stack direction="row" role="radiogroup" aria-labelledby="avatar-cover-palette-label" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
      {colors.map((color) => {
        const selected = isSameAvatarCoverColor(color, selectedColor);
        return <ButtonBase key={color} role="radio" aria-checked={selected} aria-label={`${label}: ${color}`}
          tabIndex={selected ? 0 : -1} onClick={() => onChange(color)}
          onKeyDown={(event) => selectAvatarCoverColorWithKeyboard(event, colors, color, onChange)}
          sx={{ width: 38, height: 38, borderRadius: 1.25, border: selected ? '2px solid' : '1px solid',
            borderColor: selected ? 'primary.main' : 'divider', bgcolor: 'background.paper',
            boxShadow: selected ? 1 : 0, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
          <Box aria-hidden="true" sx={{ width: 26, height: 26, borderRadius: 0.75, bgcolor: color, border: '1px solid', borderColor: 'divider' }} />
        </ButtonBase>;
      })}
    </Stack>
  </Stack>;
}

export function BlockEditorDialog({ open, compact = false, block, locale, title, onClose, onSave, onPreview, onRemoveSection, repository, media, previewUrls, sections, sectionId, theme, serviceCatalog, servicesLoading = false, servicesError = false, onRefreshServices, focusRequest, onFocusTargetMissing }: {
  open: boolean;
  compact?: boolean;
  block: PageBlock | null;
  locale: Locale;
  title?: string;
  onClose: () => void;
  onSave: (result: BlockEditorSave) => void;
  onPreview?: (preview: BlockEditorPreview) => void;
  onRemoveSection?: (sectionId: string) => void;
  repository?: ApiPublicPageRepository;
  media?: readonly MediaReference[];
  previewUrls?: ReadonlyMap<string, string>;
  sections?: readonly PageSection[];
  sectionId?: string;
  theme: PageTheme;
  serviceCatalog?: ServicesResponse | null;
  servicesLoading?: boolean;
  servicesError?: boolean;
  onRefreshServices?: () => void;
  focusRequest?: BlockEditorFocusRequest | null;
  onFocusTargetMissing?: () => void;
}) {
  if (!open || !block) {return null;}
  return <BlockEditorDialogContent key={`${block.id}-${open ? 'open' : 'closed'}-${focusRequest?.requestId ?? 'manual'}`} open={open} compact={compact} block={block} locale={locale} title={title} onClose={onClose} onSave={onSave} onPreview={onPreview} onRemoveSection={onRemoveSection} repository={repository} media={media} previewUrls={previewUrls} sections={sections} sectionId={sectionId} theme={theme}
    serviceCatalog={serviceCatalog} servicesLoading={servicesLoading} servicesError={servicesError} onRefreshServices={onRefreshServices}
    focusRequest={focusRequest} onFocusTargetMissing={onFocusTargetMissing} />;
}

function BlockEditorDialogContent({ open, compact, block, locale, title, onClose, onSave, onPreview, onRemoveSection, repository, media = [], previewUrls, sections, sectionId, theme, serviceCatalog = null, servicesLoading = false, servicesError = false, onRefreshServices, focusRequest, onFocusTargetMissing }: {
  open: boolean; compact: boolean; block: PageBlock; locale: Locale; title?: string; onClose: () => void; onSave: (result: BlockEditorSave) => void;
  repository?: ApiPublicPageRepository; media?: readonly MediaReference[]; previewUrls?: ReadonlyMap<string, string>; sections?: readonly PageSection[]; sectionId?: string;
  onPreview?: (preview: BlockEditorPreview) => void;
  onRemoveSection?: (sectionId: string) => void;
  theme: PageTheme;
  serviceCatalog?: ServicesResponse | null;
  servicesLoading?: boolean;
  servicesError?: boolean;
  onRefreshServices?: () => void;
  focusRequest?: BlockEditorFocusRequest | null;
  onFocusTargetMissing?: () => void;
}) {
  const titleId = useId();
  const [tab, setTab] = useState(() => BLOCK_EDITOR_TAB_INDEX[focusRequest?.tab ?? 'content']);
  const initialAvatarAlt = block.type === 'avatar'
    ? (typeof block.content.imageAlt === 'string' && block.content.imageAlt.trim())
      || (typeof block.content.heading === 'string' && block.content.heading.trim())
      || publicPageText(locale, 'avatar')
    : '';
  const [draft, setDraft] = useState<PageBlock>(() => {
    const initial = structuredClone(block);
    if (initial.type === 'avatar' && typeof initial.content.imageMediaId === 'string' && !String(initial.content.imageAlt ?? '').trim()) {
      initial.content.imageAlt = initialAvatarAlt;
    }
    return initial;
  });
  const draftSectionId = sectionId ?? sections?.[0]?.id;
  const selectedSection = sections?.find((section) => section.id === draftSectionId);
  const [sectionDraft, setSectionDraft] = useState<PageSection | undefined>(() => selectedSection ? structuredClone(selectedSection) : undefined);
  const contrastSection = sectionDraft ?? selectedSection;
  const [pending, setPending] = useState<Array<{ media: MediaReference; objectUrl: string }>>([]);
  const [updatedMedia, setUpdatedMedia] = useState<MediaReference[]>(() => {
    if (block.type !== 'avatar' || typeof block.content.imageMediaId !== 'string') {return [];}
    const avatarMedia = media.find((item) => item.id === block.content.imageMediaId);
    return avatarMedia && !avatarMedia.alt.trim() ? [{ ...avatarMedia, alt: initialAvatarAlt }] : [];
  });
  const [cleanupError, setCleanupError] = useState(false);
  const failedCleanupIdsRef = useRef(new Set<string>());
  const [cleaning, setCleaning] = useState(false);
  const originalMediaId = block.design.backgroundMediaId;
  const originalAvatarMediaId = block.type === 'avatar' && typeof block.content.imageMediaId === 'string' ? block.content.imageMediaId : null;
  const originalAvatarCoverMediaId = block.type === 'avatar' && typeof block.content.coverMediaId === 'string' ? block.content.coverMediaId : null;
  const originalImageMediaId = block.type === 'image' && typeof block.content.imageMediaId === 'string' ? block.content.imageMediaId : null;
  const originalGalleryMediaIds = block.type === 'gallery' && Array.isArray(block.content.images)
    ? block.content.images.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).mediaId === 'string' ? [(item as Record<string, unknown>).mediaId as string] : []) : [];
  const originalSectionMediaId = selectedSection?.design.backgroundMediaId ?? null;
  const avatarMediaId = draft.type === 'avatar' && typeof draft.content.imageMediaId === 'string' ? draft.content.imageMediaId : null;
  const avatarCoverMediaId = draft.type === 'avatar' && typeof draft.content.coverMediaId === 'string' ? draft.content.coverMediaId : null;
  const imageMediaId = (draft.type === 'avatar' || draft.type === 'image') && typeof draft.content.imageMediaId === 'string' ? draft.content.imageMediaId : null;
  useEffect(() => { onPreview?.({ block: draft, sectionId: draftSectionId, section: sectionDraft, addedMedia: pending, updatedMedia }); }, [draft, draftSectionId, onPreview, pending, sectionDraft, updatedMedia]);
  const mediaFor = (id: string | null) => pending.find((item) => item.media.id === id)?.media ?? media.find((item) => item.id === id) ?? null;
  const mediaUrlFor = (id: string) => pending.find((item) => item.media.id === id)?.objectUrl ?? previewUrls?.get(id) ?? media.find((item) => item.id === id)?.url;
  const cleanupItems = async (items: typeof pending): Promise<boolean> => {
    if (!repository || !items.length) {return true;}
    setCleaning(true);
    const attemptedIds = new Set(items.map((item) => item.media.id));
    const failed = new Set<string>();
    for (const item of items) {
      try { await repository.deleteMedia(item.media.id); URL.revokeObjectURL(item.objectUrl); }
      catch { failed.add(item.media.id); }
    }
    const cleanupState = reconcilePendingMediaCleanup([], failedCleanupIdsRef.current, attemptedIds, failed);
    failedCleanupIdsRef.current = cleanupState.failedIds;
    setCleanupError(cleanupState.failedIds.size > 0);
    setPending((current) => reconcilePendingMediaCleanup(current, new Set(), attemptedIds, failed).pending);
    setCleaning(false);
    return failed.size === 0;
  };
  const cancel = () => { if (cleaning) {return;} void (async () => { if (await cleanupItems(pending)) {onClose();} })(); };
  const Editor = getBlockDefinition(draft.type)?.Editor;
  return (
    <Dialog open={open} aria-labelledby={titleId} onClose={cancel} fullScreen={compact} fullWidth maxWidth={false}
      slotProps={{
        paper: { style: resolvePublicPageThemeVariables(theme, sectionDraft ?? selectedSection), sx: { maxWidth: compact ? '100%' : 820, borderRadius: compact ? 0 : 4 } },
        transition: { onEntered: () => {
          if (!focusRequest) {return;}
          window.requestAnimationFrame(() => {
            if (!focusMarkedEditorControl(focusRequest.marker)) {onFocusTargetMissing?.();}
          });
        } },
      }}>
      <DialogTitle id={`${titleId}-header`} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 68, px: 3, py: 1.5 }}>
        <Typography id={titleId} component="span" variant="h6" sx={{ flex: 1 }}>{title ?? draft.name}</Typography>
        <IconButton aria-label={publicPageText(locale, 'close')} onClick={cancel}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: 3 }}>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant={compact ? 'scrollable' : 'standard'} scrollButtons={compact ? 'auto' : false} allowScrollButtonsMobile={compact} sx={{ mb: 2.5, minHeight: 48, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={publicPageText(locale, 'tabContent')} data-public-page-editor-tab="content" />
          <Tab label={publicPageText(locale, 'tabDesign')} data-public-page-editor-tab="design" />
          <Tab label={publicPageText(locale, 'tabSettings')} data-public-page-editor-tab="settings" />
          <Tab label={publicPageText(locale, 'tabSection')} data-public-page-editor-tab="section" disabled={!sections?.length} />
        </Tabs>
        <Stack spacing={2} sx={{ p: { xs: 1.5, sm: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {tab === 0 ? <Stack spacing={2} data-public-page-focus="block.content" tabIndex={-1}>
          {draft.type === 'image' && repository ? <ImageUploadControl focusMarker="block.content.media"
            altFocusMarker={imageMediaId ? `media:${imageMediaId}:alt` : undefined} label={publicPageText(locale, 'image')}
            media={mediaFor(imageMediaId)} previewUrl={imageMediaId ? pending.find((item) => item.media.id === imageMediaId)?.objectUrl ?? previewUrls?.get(imageMediaId) : undefined}
            repository={repository} uploadLabel={publicPageText(locale, 'uploadImage')} replaceLabel={publicPageText(locale, 'replaceImage')}
            removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
            invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
            onAltChange={(updated) => {
              if (pending.some((item) => item.media.id === updated.id)) { setPending((items) => items.map((item) => item.media.id === updated.id ? { ...item, media: updated } : item)); }
              else { setUpdatedMedia((items) => [...items.filter((item) => item.id !== updated.id), updated]); }
              setDraft((current) => ({ ...current, content: { ...current.content, alt: updated.alt } }));
            }}
            onUploaded={(uploaded, objectUrl) => {
              const uploadedItem = { media: uploaded, objectUrl };
              setPending((items) => [...items, uploadedItem]);
              const oldPending = pending.find((item) => item.media.id === imageMediaId);
              void (async () => {
                if (oldPending && !(await cleanupItems([oldPending]))) { await cleanupItems([uploadedItem]); return; }
                setDraft((current) => ({ ...current, content: { ...current.content, imageMediaId: uploaded.id, alt: uploaded.alt } }));
              })();
            }}
            onRemoved={() => {
              const oldPending = pending.find((item) => item.media.id === imageMediaId);
              void (async () => {
                if (oldPending && !(await cleanupItems([oldPending]))) {return;}
                setDraft((current) => ({ ...current, content: { ...current.content, imageMediaId: null } }));
              })();
            }} /> : null}
          {draft.type === 'gallery' && repository ? <Stack spacing={1.5}>
            {(Array.isArray(draft.content.images) ? draft.content.images : []).map((rawItem, index) => {
              const item = rawItem && typeof rawItem === 'object' ? rawItem as Record<string, unknown> : {};
              const mediaId = typeof item.mediaId === 'string' ? item.mediaId : null;
               return <ImageUploadControl key={mediaId ?? `gallery-${index}`} focusMarker="block.content.media"
                 altFocusMarker={mediaId ? `media:${mediaId}:alt` : undefined} label={`${publicPageText(locale, 'image')} ${index + 1}`}
                media={mediaFor(mediaId)} previewUrl={mediaId ? pending.find((candidate) => candidate.media.id === mediaId)?.objectUrl ?? previewUrls?.get(mediaId) : undefined}
                repository={repository} uploadLabel={publicPageText(locale, 'uploadImage')} replaceLabel={publicPageText(locale, 'replaceImage')}
                removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
                invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
                onAltChange={(updated) => {
                  if (pending.some((candidate) => candidate.media.id === updated.id)) {setPending((items) => items.map((candidate) => candidate.media.id === updated.id ? { ...candidate, media: updated } : candidate));}
                  else {setUpdatedMedia((items) => [...items.filter((candidate) => candidate.id !== updated.id), updated]);}
                  setDraft((current) => ({ ...current, content: { ...current.content, images: (Array.isArray(current.content.images) ? current.content.images : []).map((candidate, candidateIndex) => candidateIndex === index ? { ...(candidate as Record<string, unknown>), alt: updated.alt } : candidate) } }));
                }}
                onUploaded={(uploaded, objectUrl) => {
                  const uploadedItem = { media: uploaded, objectUrl }; setPending((items) => [...items, uploadedItem]);
                  const oldPending = pending.find((candidate) => candidate.media.id === mediaId);
                  void (async () => { if (oldPending && !(await cleanupItems([oldPending]))) {await cleanupItems([uploadedItem]); return;}
                    setDraft((current) => ({ ...current, content: { ...current.content, images: (Array.isArray(current.content.images) ? current.content.images : []).map((candidate, candidateIndex) => candidateIndex === index ? { ...(candidate as Record<string, unknown>), mediaId: uploaded.id, alt: uploaded.alt } : candidate) } })); })();
                }}
                onRemoved={() => { const oldPending = pending.find((candidate) => candidate.media.id === mediaId); void (async () => { if (oldPending && !(await cleanupItems([oldPending]))) {return;}
                  setDraft((current) => ({ ...current, content: { ...current.content, images: (Array.isArray(current.content.images) ? current.content.images : []).filter((_, candidateIndex) => candidateIndex !== index) } })); })(); }} />;
            })}
            <ImageUploadControl focusMarker="block.content.media" label={publicPageText(locale, 'addImage')} media={null} repository={repository}
              uploadLabel={publicPageText(locale, 'addImage')} replaceLabel={publicPageText(locale, 'replaceImage')} removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
              invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
              onAltChange={() => undefined} onUploaded={(uploaded, objectUrl) => { setPending((items) => [...items, { media: uploaded, objectUrl }]); setDraft((current) => ({ ...current, content: { ...current.content, images: [...(Array.isArray(current.content.images) ? current.content.images : []), { mediaId: uploaded.id, alt: uploaded.alt }] } })); }} onRemoved={() => undefined} />
          </Stack> : null}
          {draft.type === 'services' ? <ServicesBlockEditor block={draft} locale={locale} catalog={serviceCatalog}
            loading={servicesLoading} error={servicesError} onRefresh={onRefreshServices ?? (() => undefined)}
            onContentChange={(content) => setDraft((current) => ({ ...current, content }))} />
          : draft.type === 'text' ? <RichTextEditor locale={locale} value={normalizeRichTextDocument(draft.content.document)}
            onChange={(document) => setDraft((current) => ({ ...current, content: { document } }))} />
          : Editor ? <Editor block={draft} mediaUrlFor={mediaUrlFor} onContentChange={(content) => setDraft({ ...draft, content })}
            pageTheme={theme} pageSection={sectionDraft ?? selectedSection}
            avatarMediaControl={draft.type === 'avatar' && repository ? <ImageUploadControl compact focusMarker="block.content.media"
              altFocusMarker={avatarMediaId ? `media:${avatarMediaId}:alt` : undefined} label={publicPageText(locale, 'avatar')}
              defaultAlt={(typeof draft.content.heading === 'string' && draft.content.heading.trim()) || publicPageText(locale, 'avatar')}
              media={mediaFor(avatarMediaId)} previewUrl={avatarMediaId ? mediaUrlFor(avatarMediaId) : undefined}
              repository={repository} uploadLabel={publicPageText(locale, 'uploadImage')} replaceLabel={publicPageText(locale, 'replaceImage')}
              removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
              invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
              onAltChange={(updated) => {
                if (pending.some((item) => item.media.id === updated.id)) {setPending((items) => items.map((item) => item.media.id === updated.id ? { ...item, media: updated } : item));}
                else {setUpdatedMedia((items) => [...items.filter((item) => item.id !== updated.id), updated]);}
                setDraft((current) => ({ ...current, content: { ...current.content, imageAlt: updated.alt } }));
              }}
              onUploaded={(uploaded, objectUrl) => {
                const uploadedItem = { media: uploaded, objectUrl };
                setPending((items) => [...items, uploadedItem]);
                const oldPending = pending.find((item) => item.media.id === avatarMediaId);
                void (async () => {
                  if (oldPending && !(await cleanupItems([oldPending]))) {await cleanupItems([uploadedItem]); return;}
                  setDraft((current) => ({ ...current, content: { ...current.content, imageMediaId: uploaded.id, imageAlt: uploaded.alt } }));
                })();
              }}
              onRemoved={() => {
                const oldPending = pending.find((item) => item.media.id === avatarMediaId);
                void (async () => {
                  if (oldPending && !(await cleanupItems([oldPending]))) {return;}
                  setDraft((current) => ({ ...current, content: { ...current.content, imageMediaId: null } }));
                })();
              }} /> : undefined}
            avatarCoverControl={draft.type === 'avatar' && theme ? <AvatarCoverPalette locale={locale} theme={theme} value={draft.content.coverColor}
              onChange={(coverColor) => setDraft((current) => ({ ...current, content: applyAvatarCoverColor(current.content, coverColor) }))} /> : undefined} /> : null}
          </Stack> : null}
          {tab === 1 ? <Stack spacing={2} data-public-page-focus="block.design" tabIndex={-1}>
          {draft.type !== 'social-button' ? <><ColorControl label={publicPageText(locale, 'background')} value={draft.design.backgroundColor}
            onChange={(value) => setDraft({ ...draft, design: { ...draft.design, backgroundColor: value } })} />
          <ColorControl label={publicPageText(locale, 'textColor')} value={draft.design.textColor}
            onChange={(value) => setDraft({ ...draft, design: { ...draft.design, textColor: value } })} /></> : null}
          {repository ? <ImageUploadControl focusMarker="block.design.backgroundMediaId"
            altFocusMarker={draft.design.backgroundMediaId ? `media:${draft.design.backgroundMediaId}:alt` : undefined}
            label={publicPageText(locale, 'blockBackground')} media={mediaFor(draft.design.backgroundMediaId)}
            previewUrl={draft.design.backgroundMediaId ? pending.find((item) => item.media.id === draft.design.backgroundMediaId)?.objectUrl ?? previewUrls?.get(draft.design.backgroundMediaId) : undefined}
            repository={repository} uploadLabel={publicPageText(locale, 'uploadImage')} replaceLabel={publicPageText(locale, 'replaceImage')}
            removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
            invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
            onAltChange={(updated) => {
              if (pending.some((item) => item.media.id === updated.id)) { setPending((items) => items.map((item) => item.media.id === updated.id ? { ...item, media: updated } : item)); }
              else { setUpdatedMedia((items) => [...items.filter((item) => item.id !== updated.id), updated]); }
            }}
            onUploaded={(uploaded, objectUrl) => {
              const uploadedItem = { media: uploaded, objectUrl };
              setPending((items) => [...items, uploadedItem]);
              const oldPending = pending.find((item) => item.media.id === draft.design.backgroundMediaId);
              void (async () => {
                if (oldPending && !(await cleanupItems([oldPending]))) { await cleanupItems([uploadedItem]); return; }
                setDraft((current) => ({ ...current, design: { ...current.design, backgroundMediaId: uploaded.id } }));
              })();
            }}
            onRemoved={() => {
              const oldPending = pending.find((item) => item.media.id === draft.design.backgroundMediaId);
              void (async () => {
                if (oldPending && !(await cleanupItems([oldPending]))) {return;}
                setDraft((current) => ({ ...current, design: { ...current.design, backgroundMediaId: null } }));
              })();
            }} /> : null}
          {cleanupError ? <Alert severity="error">{publicPageText(locale, 'mediaCleanupError')}</Alert> : null}
          <TextField type="number" label={publicPageText(locale, 'overlay')} value={Math.round(draft.design.backgroundOverlay * 100)} slotProps={{ htmlInput: { min: 0, max: 100 } }}
            onChange={(event) => setDraft({ ...draft, design: { ...draft.design, backgroundOverlay: Math.max(0, Math.min(100, Number(event.target.value))) / 100 } })} />
          <TextField select label={publicPageText(locale, 'imageFit')} value={draft.design.backgroundFit}
            onChange={(event) => setDraft({ ...draft, design: { ...draft.design, backgroundFit: event.target.value as 'cover' | 'contain' } })}>
            <MenuItem value="cover">{publicPageText(locale, 'imageFitCover')}</MenuItem><MenuItem value="contain">{publicPageText(locale, 'imageFitContain')}</MenuItem>
          </TextField>
          <TextField label={publicPageText(locale, 'focalPoint')} value={draft.design.backgroundPosition}
            onChange={(event) => setDraft({ ...draft, design: { ...draft.design, backgroundPosition: event.target.value } })} />
          {(['paddingTop', 'paddingBottom'] as const).map((field) => <TextField key={field} type="number" label={publicPageText(locale, field)} value={draft.design[field]}
            slotProps={{ htmlInput: { min: 0, max: 160 } }} onChange={(event) => setDraft({ ...draft, design: { ...draft.design, [field]: Math.max(0, Math.min(160, Number(event.target.value))) } })} />)}
          {draft.type !== 'social-button' ? <Button onClick={() => setDraft({ ...draft, design: { ...draft.design, backgroundColor: null, textColor: null } })}>{publicPageText(locale, 'theme')}</Button> : null}
          {(draft.design.backgroundColor || draft.design.backgroundMediaId || draft.design.textColor) && contrastSection
            ? <ContrastGuidance locale={locale} checks={analyzeBlockContrast(theme, contrastSection, draft)} />
            : null}
          </Stack> : null}
          {tab === 2 ? <Stack spacing={2} data-public-page-focus="block.settings" tabIndex={-1}>
            <TextField label={publicPageText(locale, 'name')} value={draft.name}
              slotProps={{ htmlInput: { 'data-public-page-focus': 'block.name' } }}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <FormControlLabel data-public-page-focus="block.visible" label={publicPageText(locale, 'visible')} control={<Switch checked={draft.visible}
              onChange={(_, checked) => setDraft({ ...draft, visible: checked })} />} />
          </Stack> : null}
          {tab === 3 ? <Stack spacing={2} data-public-page-focus="section.design" tabIndex={-1}>
            {sectionDraft ? <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
              <TextField fullWidth select label={publicPageText(locale, 'section')} value={sectionDraft.design.variant}
                onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, variant: event.target.value as PageSection['design']['variant'] } })}>
                <MenuItem value="off">{publicPageText(locale, 'sectionOff')}</MenuItem>
                <MenuItem value="custom">{publicPageText(locale, 'newSection')}</MenuItem>
                <MenuItem disabled>{publicPageText(locale, 'sectionsFromDesign')}</MenuItem>
                <MenuItem value="primary">{publicPageText(locale, 'primarySection')}</MenuItem>
                <MenuItem value="secondary">{publicPageText(locale, 'secondarySection')}</MenuItem>
              </TextField>
              {onRemoveSection && draftSectionId ? <Button color="error" variant="contained" startIcon={<DeleteOutlined />}
                sx={{ flexShrink: 0 }}
              disabled={cleaning}
              onClick={() => { void (async () => {
                if (!window.confirm(publicPageText(locale, 'deleteSectionConfirm'))) {return;}
                if (!(await cleanupItems(pending))) {return;}
                onRemoveSection(draftSectionId);
                onClose();
              })(); }}>{publicPageText(locale, 'removeSection')}</Button> : null}
            </Stack>
            <SectionDesignControls locale={locale} theme={theme} section={sectionDraft} onChange={setSectionDraft}
              backgroundImageControl={repository ? <ImageUploadControl focusMarker="section.design.backgroundMediaId"
                altFocusMarker={sectionDraft.design.backgroundMediaId ? `media:${sectionDraft.design.backgroundMediaId}:alt` : undefined}
                label={publicPageText(locale, 'sectionBackground')} media={mediaFor(sectionDraft.design.backgroundMediaId)}
                previewUrl={sectionDraft.design.backgroundMediaId ? pending.find((item) => item.media.id === sectionDraft.design.backgroundMediaId)?.objectUrl ?? previewUrls?.get(sectionDraft.design.backgroundMediaId) : undefined}
                repository={repository} uploadLabel={publicPageText(locale, 'uploadImage')} replaceLabel={publicPageText(locale, 'replaceImage')}
                removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
                invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
                onAltChange={(updated) => setUpdatedMedia((items) => [...items.filter((item) => item.id !== updated.id), updated])}
                onUploaded={(uploaded, objectUrl) => {
                  const uploadedItem = { media: uploaded, objectUrl };
                  setPending((items) => [...items, uploadedItem]);
                  const oldPending = pending.find((item) => item.media.id === sectionDraft.design.backgroundMediaId);
                  void (async () => {
                    if (oldPending && !(await cleanupItems([oldPending]))) { await cleanupItems([uploadedItem]); return; }
                    setSectionDraft((current) => current ? ({ ...current, design: { ...current.design, backgroundMediaId: uploaded.id } }) : current);
                  })();
                }}
                onRemoved={() => {
                  const oldPending = pending.find((item) => item.media.id === sectionDraft.design.backgroundMediaId);
                  void (async () => {
                    if (oldPending && !(await cleanupItems([oldPending]))) {return;}
                    setSectionDraft((current) => current ? ({ ...current, design: { ...current.design, backgroundMediaId: null } }) : current);
                  })();
                }} /> : undefined} />
            </> : null}
          </Stack> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button disabled={cleaning} onClick={cancel}>{publicPageText(locale, 'cancel')}</Button>
        <Button disabled={cleaning || cleanupError} variant="contained" onClick={() => onSave({ block: draft, sectionId: draftSectionId, section: sectionDraft, addedMedia: pending, updatedMedia, removedMediaIds: [
          ...(originalMediaId && originalMediaId !== draft.design.backgroundMediaId ? [originalMediaId] : []),
          ...(originalAvatarMediaId && originalAvatarMediaId !== avatarMediaId ? [originalAvatarMediaId] : []),
          ...(originalAvatarCoverMediaId && originalAvatarCoverMediaId !== avatarCoverMediaId ? [originalAvatarCoverMediaId] : []),
          ...(originalImageMediaId && originalImageMediaId !== imageMediaId ? [originalImageMediaId] : []),
          ...originalGalleryMediaIds.filter((mediaId) => !(draft.type === 'gallery' && Array.isArray(draft.content.images)
            && draft.content.images.some((item) => item && typeof item === 'object' && (item as Record<string, unknown>).mediaId === mediaId))),
          ...(originalSectionMediaId && originalSectionMediaId !== sectionDraft?.design.backgroundMediaId ? [originalSectionMediaId] : []),
        ] })}>{publicPageText(locale, 'save')}</Button>
      </DialogActions>
    </Dialog>
  );
}
