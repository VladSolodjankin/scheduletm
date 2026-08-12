import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Tab, Tabs, TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type { MediaReference, PageBlock, PageSection, TypographyStyle } from '../../features/public-page-builder/types/publicPage';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { publicPageText } from './uiText';
import { ImageUploadControl } from './ImageUploadControl';
import { reconcilePendingMediaCleanup } from '../../features/public-page-builder/model/media';

export type BlockEditorSave = { block: PageBlock; sectionId?: string; section?: PageSection; addedMedia: Array<{ media: MediaReference; objectUrl: string }>; updatedMedia: MediaReference[]; removedMediaIds: string[] };
export type BlockEditorPreview = Pick<BlockEditorSave, 'block' | 'sectionId' | 'section' | 'addedMedia' | 'updatedMedia'>;

function nullableNumber(value: string, minimum: number, maximum: number): number | null {
  return value === '' ? null : Math.max(minimum, Math.min(maximum, Number(value)));
}

function TypographyControls({ locale, label, value, onChange }: { locale: Locale; label: string; value: TypographyStyle; onChange: (value: TypographyStyle) => void }) {
  return <Stack spacing={1}>
    <TextField label={label} value={value.fontFamily ?? ''} placeholder={publicPageText(locale, 'inherit')}
      onChange={(event) => onChange({ ...value, fontFamily: event.target.value || null })} />
    <TextField type="number" label={publicPageText(locale, 'fontSize')} value={value.fontSize ?? ''} placeholder={publicPageText(locale, 'inherit')}
      slotProps={{ htmlInput: { min: 8, max: 96 } }} onChange={(event) => onChange({ ...value, fontSize: nullableNumber(event.target.value, 8, 96) })} />
    <TextField type="number" label={publicPageText(locale, 'fontWeight')} value={value.fontWeight ?? ''} placeholder={publicPageText(locale, 'inherit')}
      slotProps={{ htmlInput: { min: 100, max: 900, step: 100 } }} onChange={(event) => onChange({ ...value, fontWeight: nullableNumber(event.target.value, 100, 900) })} />
    <TextField select label={publicPageText(locale, 'fontStyle')} value={value.fontStyle ?? ''}
      onChange={(event) => onChange({ ...value, fontStyle: event.target.value === '' ? null : event.target.value as 'normal' | 'italic' })}>
      <MenuItem value="">{publicPageText(locale, 'inherit')}</MenuItem><MenuItem value="normal">{publicPageText(locale, 'normal')}</MenuItem><MenuItem value="italic">{publicPageText(locale, 'italic')}</MenuItem>
    </TextField>
    <ColorControl label={publicPageText(locale, 'textColor')} value={value.color} onChange={(color) => onChange({ ...value, color })} />
  </Stack>;
}

export function BlockEditorDialog({ open, block, locale, title, onClose, onSave, onPreview, repository, media, previewUrls, sections, sectionId }: {
  open: boolean;
  block: PageBlock | null;
  locale: Locale;
  title?: string;
  onClose: () => void;
  onSave: (result: BlockEditorSave) => void;
  onPreview?: (preview: BlockEditorPreview) => void;
  repository?: ApiPublicPageRepository;
  media?: readonly MediaReference[];
  previewUrls?: ReadonlyMap<string, string>;
  sections?: readonly PageSection[];
  sectionId?: string;
}) {
  if (!open || !block) {return null;}
  return <BlockEditorDialogContent key={`${block.id}-${open ? 'open' : 'closed'}`} open={open} block={block} locale={locale} title={title} onClose={onClose} onSave={onSave} onPreview={onPreview} repository={repository} media={media} previewUrls={previewUrls} sections={sections} sectionId={sectionId} />;
}

function BlockEditorDialogContent({ open, block, locale, title, onClose, onSave, onPreview, repository, media = [], previewUrls, sections, sectionId }: {
  open: boolean; block: PageBlock; locale: Locale; title?: string; onClose: () => void; onSave: (result: BlockEditorSave) => void;
  repository?: ApiPublicPageRepository; media?: readonly MediaReference[]; previewUrls?: ReadonlyMap<string, string>; sections?: readonly PageSection[]; sectionId?: string;
  onPreview?: (preview: BlockEditorPreview) => void;
}) {
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<PageBlock>(() => structuredClone(block));
  const draftSectionId = sectionId ?? sections?.[0]?.id;
  const selectedSection = sections?.find((section) => section.id === draftSectionId);
  const [sectionDraft, setSectionDraft] = useState<PageSection | undefined>(() => selectedSection ? structuredClone(selectedSection) : undefined);
  const [pending, setPending] = useState<Array<{ media: MediaReference; objectUrl: string }>>([]);
  const [updatedMedia, setUpdatedMedia] = useState<MediaReference[]>([]);
  const [cleanupError, setCleanupError] = useState(false);
  const failedCleanupIdsRef = useRef(new Set<string>());
  const [cleaning, setCleaning] = useState(false);
  const originalMediaId = block.design.backgroundMediaId;
  const originalAvatarMediaId = block.type === 'avatar' && typeof block.content.imageMediaId === 'string' ? block.content.imageMediaId : null;
  const originalImageMediaId = block.type === 'image' && typeof block.content.imageMediaId === 'string' ? block.content.imageMediaId : null;
  const originalGalleryMediaIds = block.type === 'gallery' && Array.isArray(block.content.images)
    ? block.content.images.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).mediaId === 'string' ? [(item as Record<string, unknown>).mediaId as string] : []) : [];
  const originalSectionMediaId = selectedSection?.design.backgroundMediaId ?? null;
  const avatarMediaId = draft.type === 'avatar' && typeof draft.content.imageMediaId === 'string' ? draft.content.imageMediaId : null;
  const imageMediaId = (draft.type === 'avatar' || draft.type === 'image') && typeof draft.content.imageMediaId === 'string' ? draft.content.imageMediaId : null;
  useEffect(() => { onPreview?.({ block: draft, sectionId: draftSectionId, section: sectionDraft, addedMedia: pending, updatedMedia }); }, [draft, draftSectionId, onPreview, pending, sectionDraft, updatedMedia]);
  const mediaFor = (id: string | null) => pending.find((item) => item.media.id === id)?.media ?? media.find((item) => item.id === id) ?? null;
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
    <Dialog open={open} onClose={cancel} fullWidth maxWidth="sm">
      <DialogTitle>{title ?? draft.name}</DialogTitle>
      <DialogContent dividers>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} sx={{ mb: 2 }}>
          <Tab label={publicPageText(locale, 'tabContent')} />
          <Tab label={publicPageText(locale, 'tabSettings')} />
          <Tab label={publicPageText(locale, 'tabSection')} disabled={!sections?.length} />
        </Tabs>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {tab === 0 ? <>
          {(draft.type === 'avatar' || draft.type === 'image') && repository ? <ImageUploadControl label={publicPageText(locale, draft.type === 'avatar' ? 'avatar' : 'image')}
            media={mediaFor(imageMediaId)} previewUrl={imageMediaId ? pending.find((item) => item.media.id === imageMediaId)?.objectUrl ?? previewUrls?.get(imageMediaId) : undefined}
            repository={repository} uploadLabel={publicPageText(locale, 'uploadImage')} replaceLabel={publicPageText(locale, 'replaceImage')}
            removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
            invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
            onAltChange={(updated) => {
              if (pending.some((item) => item.media.id === updated.id)) { setPending((items) => items.map((item) => item.media.id === updated.id ? { ...item, media: updated } : item)); }
              else { setUpdatedMedia((items) => [...items.filter((item) => item.id !== updated.id), updated]); }
              setDraft((current) => ({ ...current, content: { ...current.content, [current.type === 'avatar' ? 'imageAlt' : 'alt']: updated.alt } }));
            }}
            onUploaded={(uploaded, objectUrl) => {
              const uploadedItem = { media: uploaded, objectUrl };
              setPending((items) => [...items, uploadedItem]);
              const oldPending = pending.find((item) => item.media.id === imageMediaId);
              void (async () => {
                if (oldPending && !(await cleanupItems([oldPending]))) { await cleanupItems([uploadedItem]); return; }
                setDraft((current) => ({ ...current, content: { ...current.content, imageMediaId: uploaded.id, [current.type === 'avatar' ? 'imageAlt' : 'alt']: uploaded.alt } }));
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
              return <ImageUploadControl key={mediaId ?? `gallery-${index}`} label={`${publicPageText(locale, 'image')} ${index + 1}`}
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
            <ImageUploadControl label={publicPageText(locale, 'addImage')} media={null} repository={repository}
              uploadLabel={publicPageText(locale, 'addImage')} replaceLabel={publicPageText(locale, 'replaceImage')} removeLabel={publicPageText(locale, 'remove')} altLabel={publicPageText(locale, 'imageAlt')}
              invalidTypeText={publicPageText(locale, 'invalidImageType')} tooLargeText={publicPageText(locale, 'imageTooLarge')} uploadErrorText={publicPageText(locale, 'imageUploadError')}
              onAltChange={() => undefined} onUploaded={(uploaded, objectUrl) => { setPending((items) => [...items, { media: uploaded, objectUrl }]); setDraft((current) => ({ ...current, content: { ...current.content, images: [...(Array.isArray(current.content.images) ? current.content.images : []), { mediaId: uploaded.id, alt: uploaded.alt }] } })); }} onRemoved={() => undefined} />
          </Stack> : null}
          {Editor ? <Editor block={draft} onContentChange={(content) => setDraft({ ...draft, content })} /> : null}
          </> : null}
          {tab === 1 ? <>
          <TextField label={publicPageText(locale, 'name')} value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <FormControlLabel label={publicPageText(locale, 'visible')} control={<Switch checked={draft.visible}
            onChange={(_, checked) => setDraft({ ...draft, visible: checked })} />} />
          {draft.type !== 'social-button' ? <><ColorControl label={publicPageText(locale, 'background')} value={draft.design.backgroundColor}
            onChange={(value) => setDraft({ ...draft, design: { ...draft.design, backgroundColor: value } })} />
          <ColorControl label={publicPageText(locale, 'textColor')} value={draft.design.textColor}
            onChange={(value) => setDraft({ ...draft, design: { ...draft.design, textColor: value } })} /></> : null}
          {repository ? <ImageUploadControl label={publicPageText(locale, 'blockBackground')} media={mediaFor(draft.design.backgroundMediaId)}
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
          </> : null}
          {tab === 2 ? <>
            {sectionDraft ? <>
            <TextField select label={publicPageText(locale, 'section')} value={sectionDraft.design.variant}
              onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, variant: event.target.value as PageSection['design']['variant'] } })}>
              <MenuItem value="off">{publicPageText(locale, 'sectionOff')}</MenuItem>
              <MenuItem value="custom">{publicPageText(locale, 'newSection')}</MenuItem>
              <MenuItem disabled>{publicPageText(locale, 'sectionsFromDesign')}</MenuItem>
              <MenuItem value="primary">{publicPageText(locale, 'primarySection')}</MenuItem>
              <MenuItem value="secondary">{publicPageText(locale, 'secondarySection')}</MenuItem>
            </TextField>
            <ColorControl label={publicPageText(locale, 'background')} value={sectionDraft.design.backgroundColor}
              onChange={(value) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, backgroundColor: value } })} />
            <ColorControl label={publicPageText(locale, 'textColor')} value={sectionDraft.design.textColor}
              onChange={(value) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, textColor: value } })} />
            {repository ? <ImageUploadControl label={publicPageText(locale, 'sectionBackground')} media={mediaFor(sectionDraft.design.backgroundMediaId)}
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
              }} /> : null}
            <TextField type="number" label={publicPageText(locale, 'overlay')} value={Math.round(sectionDraft.design.backgroundOverlay * 100)} slotProps={{ htmlInput: { min: 0, max: 100 } }}
              onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, backgroundOverlay: Math.max(0, Math.min(100, Number(event.target.value))) / 100 } })} />
            <TextField select label={publicPageText(locale, 'imageFit')} value={sectionDraft.design.backgroundFit}
              onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, backgroundFit: event.target.value as 'cover' | 'contain' } })}>
              <MenuItem value="cover">{publicPageText(locale, 'imageFitCover')}</MenuItem><MenuItem value="contain">{publicPageText(locale, 'imageFitContain')}</MenuItem>
            </TextField>
            <TextField label={publicPageText(locale, 'focalPoint')} value={sectionDraft.design.backgroundPosition}
              onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, backgroundPosition: event.target.value } })} />
            {(['paddingTop', 'paddingBottom', 'borderWidth'] as const).map((field) => {
              const maximum = field === 'borderWidth' ? 16 : 160;
              return <TextField key={field} type="number" label={publicPageText(locale, field)} value={sectionDraft.design[field]}
                slotProps={{ htmlInput: { min: 0, max: maximum } }}
                onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, [field]: Math.max(0, Math.min(maximum, Number(event.target.value))) } })} />;
            })}
            <FormControlLabel label={publicPageText(locale, 'horizontalMargin')} control={<Switch checked={sectionDraft.design.horizontalMargin}
              onChange={(_, checked) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, horizontalMargin: checked } })} />} />
            <FormControlLabel label={publicPageText(locale, 'shadow')} control={<Switch checked={sectionDraft.design.shadow}
              onChange={(_, checked) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, shadow: checked } })} />} />
            <FormControlLabel label={publicPageText(locale, 'mobileVisible')} control={<Switch checked={sectionDraft.design.mobileVisible}
              onChange={(_, checked) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, mobileVisible: checked } })} />} />
            <TextField select label={publicPageText(locale, 'sectionWidth')} value={sectionDraft.design.width}
              onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, width: event.target.value as 'full' | 'contained' } })}>
              <MenuItem value="full">{publicPageText(locale, 'widthFull')}</MenuItem><MenuItem value="contained">{publicPageText(locale, 'widthContained')}</MenuItem>
            </TextField>
            <ColorControl label={publicPageText(locale, 'borderColor')} value={sectionDraft.design.borderColor}
              onChange={(value) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, borderColor: value } })} />
            <TypographyControls locale={locale} label={publicPageText(locale, 'headingStyle')} value={sectionDraft.design.headingStyle}
              onChange={(headingStyle) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, headingStyle } })} />
            <TypographyControls locale={locale} label={publicPageText(locale, 'bodyStyle')} value={sectionDraft.design.textStyle}
              onChange={(textStyle) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, textStyle } })} />
            <TypographyControls locale={locale} label={publicPageText(locale, 'titleStyle')} value={sectionDraft.design.linkStyle.titleStyle}
              onChange={(titleStyle) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, titleStyle } } })} />
            <TypographyControls locale={locale} label={publicPageText(locale, 'subtitleStyle')} value={sectionDraft.design.linkStyle.subtitleStyle}
              onChange={(subtitleStyle) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, subtitleStyle } } })} />
            <ColorControl label={publicPageText(locale, 'background')} value={sectionDraft.design.linkStyle.backgroundColor}
              onChange={(backgroundColor) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, backgroundColor } } })} />
            <TextField type="number" label={publicPageText(locale, 'backgroundOpacity')} value={sectionDraft.design.linkStyle.backgroundOpacity ?? ''} placeholder={publicPageText(locale, 'inherit')}
              slotProps={{ htmlInput: { min: 0, max: 1, step: 0.05 } }} onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, backgroundOpacity: nullableNumber(event.target.value, 0, 1) } } })} />
            <TextField type="number" label={publicPageText(locale, 'borderWidth')} value={sectionDraft.design.linkStyle.borderWidth ?? ''} placeholder={publicPageText(locale, 'inherit')}
              slotProps={{ htmlInput: { min: 0, max: 16 } }} onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, borderWidth: nullableNumber(event.target.value, 0, 16) } } })} />
            <ColorControl label={publicPageText(locale, 'borderColor')} value={sectionDraft.design.linkStyle.borderColor}
              onChange={(borderColor) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, borderColor } } })} />
            <TextField select label={publicPageText(locale, 'shadow')} value={sectionDraft.design.linkStyle.shadow === null ? '' : String(sectionDraft.design.linkStyle.shadow)}
              onChange={(event) => setSectionDraft({ ...sectionDraft, design: { ...sectionDraft.design, linkStyle: { ...sectionDraft.design.linkStyle, shadow: event.target.value === '' ? null : event.target.value === 'true' } } })}>
              <MenuItem value="">{publicPageText(locale, 'inherit')}</MenuItem><MenuItem value="true">{publicPageText(locale, 'show')}</MenuItem><MenuItem value="false">{publicPageText(locale, 'hide')}</MenuItem>
            </TextField>
            </> : null}
          </> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={cleaning} onClick={cancel}>{publicPageText(locale, 'cancel')}</Button>
        <Button disabled={cleaning || cleanupError} variant="contained" onClick={() => onSave({ block: draft, sectionId: draftSectionId, section: sectionDraft, addedMedia: pending, updatedMedia, removedMediaIds: [
          ...(originalMediaId && originalMediaId !== draft.design.backgroundMediaId ? [originalMediaId] : []),
          ...(originalAvatarMediaId && originalAvatarMediaId !== avatarMediaId ? [originalAvatarMediaId] : []),
          ...(originalImageMediaId && originalImageMediaId !== imageMediaId ? [originalImageMediaId] : []),
          ...originalGalleryMediaIds.filter((mediaId) => !(draft.type === 'gallery' && Array.isArray(draft.content.images)
            && draft.content.images.some((item) => item && typeof item === 'object' && (item as Record<string, unknown>).mediaId === mediaId))),
          ...(originalSectionMediaId && originalSectionMediaId !== sectionDraft?.design.backgroundMediaId ? [originalSectionMediaId] : []),
        ] })}>{publicPageText(locale, 'save')}</Button>
      </DialogActions>
    </Dialog>
  );
}
