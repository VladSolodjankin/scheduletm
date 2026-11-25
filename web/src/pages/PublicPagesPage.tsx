import { Add, Archive, ContentCopy, ContentPaste, DataObject, Delete, Edit, InsightsOutlined, OpenInNew, RestoreFromTrash } from '@mui/icons-material';
import {
  Alert, Box, Button, ButtonBase, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppPage } from '../shared/ui/AppPage';
import { AppList, AppListRow, AppListThumb } from '../shared/ui/AppList';
import { AppEmptyState, AppStatusBadge } from '../shared/ui/AppStatus';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import {
  PublicPageRepositoryError,
  type PublicPageRecord,
  type PublicPageRepositoryErrorCode,
} from '../features/public-page-builder/repository/PublicPageRepository';
import { createStableId } from '../features/public-page-builder/utils/createStableId';
import {
  exportPublicPageLayout,
  importPublicPageLayout,
  LayoutImportError,
} from '../features/public-page-builder/model/layoutTransfer';
import type { PublicPageDocument } from '../features/public-page-builder/types/publicPage';
import { getPublicPageTemplate, PUBLIC_PAGE_TEMPLATES, type PublicPageTemplate } from '../features/public-page-builder/templates';
import type { Locale } from '../shared/i18n/dictionaries';
import { PublicPageRenderer } from '../components/public-page-blocks/PublicPageRenderer';
import { publicPageDisplayUrl, publicPageUrl } from '../features/public-page-builder/config/publicPageUrl';
import { translate } from '../shared/i18n/translate';
import { useCopyToClipboard } from '../shared/utils/useCopyToClipboard';

type MutationError = {
  action: 'restore' | 'other';
  code: PublicPageRepositoryErrorCode | 'unknown';
};

const PUBLIC_PAGES_PRESENTATION = {
  createPreviewHeight: { xs: 'min(45dvh, 360px)', md: 'min(68dvh, 640px)' },
} as const;

function mutationFailure(error: unknown, action: MutationError['action']): MutationError {
  return {
    action,
    code: error instanceof PublicPageRepositoryError ? error.code : 'unknown',
  };
}

function cloneDocument(document: PublicPageDocument): PublicPageDocument {
  const id = createStableId();
  const remap = () => createStableId();
  const sectionIds = new Map<string, string>();
  const remapSection = (source: string) => {
    if (!sectionIds.has(source)) {sectionIds.set(source, remap());}
    return sectionIds.get(source)!;
  };
  return {
    ...structuredClone(document),
    id,
    slug: `${document.slug.slice(0, 30)}-${id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5)}`,
    status: 'draft',
    sections: document.sections.map((section) => ({
      ...section,
      id: remapSection(section.id),
      blocks: section.blocks.map((block) => ({ ...block, id: remap() })),
    })),
    archivedBlocks: document.archivedBlocks.map(({ block, sourceSectionId }) => ({
      block: { ...structuredClone(block), id: remap() }, sourceSectionId: remapSection(sourceSectionId),
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const TEMPLATE_CARD_WIDTH = 140;
/** Width the template is laid out at before it is scaled down into its thumbnail. */
const TEMPLATE_THUMBNAIL_LAYOUT_WIDTH = 420;

/** A template as a miniature of the page it creates, so a template can be picked by how it looks. */
function TemplateCard({ template, locale, selected, onSelect }: { template: PublicPageTemplate; locale: Locale; selected: boolean; onSelect: () => void }) {
  const document = useMemo(() => template.createDocument('template-thumbnail', '2026-01-01T00:00:00.000Z', locale), [template, locale]);
  const name = template.names?.[locale] ?? template.name;
  return (
    <ButtonBase aria-pressed={selected} onClick={onSelect} sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 'var(--app-space-s)', p: 'var(--app-space-s)', textAlign: 'left', width: TEMPLATE_CARD_WIDTH + 16,
      border: 'var(--app-border-width) solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 'var(--app-radius-m)',
      bgcolor: selected ? 'action.selected' : 'background.paper', color: 'text.primary',
      '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
    }}>
      <Box inert aria-hidden sx={{ position: 'relative', width: TEMPLATE_CARD_WIDTH, height: TEMPLATE_CARD_WIDTH * 4 / 3, overflow: 'hidden', borderRadius: 'var(--app-radius-s)', bgcolor: 'background.default', pointerEvents: 'none' }}>
        <Box sx={{ width: TEMPLATE_THUMBNAIL_LAYOUT_WIDTH, transformOrigin: 'top left', transform: `scale(${TEMPLATE_CARD_WIDTH / TEMPLATE_THUMBNAIL_LAYOUT_WIDTH})` }}>
          <PublicPageRenderer document={document} />
        </Box>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: selected ? 'fontWeightBold' : 'fontWeightMedium' }}>{name}</Typography>
    </ButtonBase>
  );
}

export function PublicPagesPage() {
  const { locale, t } = useI18n();
  const { accessToken } = useAuth();
  const templatesHeadingId = useId();
  const repository = useMemo(() => new ApiPublicPageRepository(accessToken), [accessToken]);
  const navigate = useNavigate();
  const [records, setRecords] = useState<PublicPageRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [createOpen, setCreateOpen] = useState(false);
  const [templateId, setTemplateId] = useState('blank');
  const [mutationError, setMutationError] = useState<MutationError | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const layoutCopy = useCopyToClipboard({ resetAfterMs: null });
  const copyNotice = layoutCopy.status === 'idle' ? null : layoutCopy.status === 'copied' ? 'copyJsonDone' : 'copyJsonError';
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<'pasteJsonInvalid' | 'pasteJsonUnsupported' | 'saveError' | null>(null);
  const templatePreview = useMemo(
    () => getPublicPageTemplate(templateId)?.createDocument('template-preview', '2026-01-01T00:00:00.000Z', locale),
    [templateId, locale],
  );

  const load = useCallback(async () => {
    try {
      setRecords(await repository.list());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [repository]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const create = async () => {
    const document = getPublicPageTemplate(templateId)?.createDocument(createStableId(), undefined, locale);
    if (!document) {return;}
    setIsMutating(true);
    setMutationError(null);
    try {
      const created = await repository.create(document);
      setCreateOpen(false);
      navigate(`/public-pages/${created.id}/edit`);
    } catch (error) {
      setMutationError(mutationFailure(error, 'other'));
    } finally {
      setIsMutating(false);
    }
  };
  const duplicate = async (record: PublicPageRecord) => {
    setIsMutating(true);
    setMutationError(null);
    try {
      await repository.create(cloneDocument(record.draft));
      await load();
    } catch (error) {
      setMutationError(mutationFailure(error, 'other'));
    } finally {
      setIsMutating(false);
    }
  };
  const copyLayout = async (record: PublicPageRecord) => {
    setMutationError(null);
    await layoutCopy.copyText(exportPublicPageLayout(record.draft));
  };
  const importLayout = async () => {
    let document: PublicPageDocument;
    try {
      document = importPublicPageLayout(pasteText);
    } catch (error) {
      setPasteError(error instanceof LayoutImportError && error.code === 'unsupported' ? 'pasteJsonUnsupported' : 'pasteJsonInvalid');
      return;
    }
    setIsMutating(true);
    setPasteError(null);
    try {
      const created = await repository.create(document);
      setPasteOpen(false);
      setPasteText('');
      navigate(`/public-pages/${created.id}/edit`);
    } catch {
      setPasteError('saveError');
    } finally {
      setIsMutating(false);
    }
  };
  const archive = async (record: PublicPageRecord) => {
    setIsMutating(true);
    setMutationError(null);
    try {
      await repository.archive(record.id, record.revision);
      await load();
    } catch (error) {
      setMutationError(mutationFailure(error, 'other'));
      await load();
    } finally {
      setIsMutating(false);
    }
  };
  const restore = async (record: PublicPageRecord) => {
    setIsMutating(true);
    setMutationError(null);
    try {
      await repository.restore(record.id, record.revision);
      await load();
    } catch (error) {
      setMutationError(mutationFailure(error, 'restore'));
      await load();
    } finally {
      setIsMutating(false);
    }
  };
  const remove = async (record: PublicPageRecord) => {
    if (!window.confirm(translate(locale, 'publicPageBuilder.deleteConfirm'))) {return;}
    setIsMutating(true);
    setMutationError(null);
    try {
      await repository.delete(record.id, record.revision);
      await load();
    } catch (error) {
      setMutationError(mutationFailure(error, 'other'));
      await load();
    } finally {
      setIsMutating(false);
    }
  };
  const statusLabels = useMemo(() => ({
    draft: translate(locale, 'publicPageBuilder.draft'),
    published: translate(locale, 'publicPageBuilder.published'),
    archived: translate(locale, 'publicPageBuilder.archived'),
  }), [locale]);
  const mutationErrorText = mutationError?.action === 'restore'
    ? translate(locale, `publicPageBuilder.${mutationError.code === 'slug_conflict'
      ? 'restoreSlugConflict'
      : mutationError.code === 'quota_exceeded'
        ? 'restoreQuotaExceeded'
        : mutationError.code === 'revision_conflict'
          ? 'restoreRevisionConflict'
          : mutationError.code === 'page_not_archived'
            ? 'restorePageState'
            : 'restoreError'}`)
    : translate(locale, 'publicPageBuilder.saveError');

  return (
    <AppPage
      title={translate(locale, 'publicPageBuilder.pages')}
      subtitle={translate(locale, 'publicPageBuilder.pagesSubtitle')}
      action={(
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<ContentPaste />} onClick={() => { setPasteError(null); setPasteOpen(true); }}>{translate(locale, 'publicPageBuilder.pasteJson')}</Button>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setCreateOpen(true)}>{translate(locale, 'publicPageBuilder.create')}</Button>
        </Stack>
      )}
    >
          <Stack spacing={3}>
            {copyNotice ? (
              <Alert severity={copyNotice === 'copyJsonDone' ? 'success' : 'error'} onClose={layoutCopy.reset}>{translate(locale, `publicPageBuilder.${copyNotice}`)}</Alert>
            ) : null}
            {status === 'loading' ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress aria-label={translate(locale, 'publicPageBuilder.loading')} /></Box>
            ) : status === 'error' ? (
              <Alert severity="error" action={<Button onClick={() => void load()}>{translate(locale, 'publicPageBuilder.retry')}</Button>}>{translate(locale, 'publicPageBuilder.saveError')}</Alert>
            ) : (
              <>
                {mutationError ? (
                  <Alert severity="error" action={<Button onClick={() => { setMutationError(null); void load(); }}>{translate(locale, 'publicPageBuilder.retry')}</Button>}>
                    {mutationErrorText}
                  </Alert>
                ) : null}
                {records.length === 0 ? (
                  <AppEmptyState title={translate(locale, 'publicPageBuilder.empty')} />
                ) : (
                  <AppList>
                    {records.map((record) => {
                      const archived = record.status === 'archived';
                      const openEditor = () => navigate(`/public-pages/${record.id}/edit`);
                      return (
                        <AppListRow
                          key={record.id}
                          muted={archived}
                          media={<AppListThumb icon={<AppIcons.publicPages fontSize="small" />} />}
                          title={record.draft.seo.title || record.draft.slug}
                          badges={(
                            <AppStatusBadge
                              label={statusLabels[record.status]}
                              tone={record.status === 'published' ? 'success' : 'neutral'}
                            />
                          )}
                          subtitle={publicPageDisplayUrl(record.draft.slug)}
                          onClick={archived ? undefined : openEditor}
                          trailing={record.published ? (
                            <Button size="small" startIcon={<OpenInNew />} href={publicPageUrl(record.published.slug)} target="_blank" rel="noopener noreferrer">
                              {translate(locale, 'publicPageBuilder.open')}
                            </Button>
                          ) : null}
                          actionsLabel={t('common.moreActions')}
                          actionsDisabled={isMutating}
                          actions={[
                            { key: 'edit', label: translate(locale, 'publicPageBuilder.edit'), icon: <Edit fontSize="small" />, hidden: archived, onClick: openEditor },
                            { key: 'analytics', label: translate(locale, 'publicPageBuilder.analytics'), icon: <InsightsOutlined fontSize="small" />, hidden: !record.published, onClick: () => navigate(`/public-pages/${record.id}/analytics`) },
                            { key: 'duplicate', label: translate(locale, 'publicPageBuilder.duplicate'), icon: <ContentCopy fontSize="small" />, onClick: () => void duplicate(record) },
                            { key: 'json', label: translate(locale, 'publicPageBuilder.copyJson'), icon: <DataObject fontSize="small" />, onClick: () => void copyLayout(record) },
                            { key: 'archive', label: translate(locale, 'publicPageBuilder.archive'), icon: <Archive fontSize="small" />, hidden: archived, onClick: () => void archive(record) },
                            { key: 'restore', label: translate(locale, 'publicPageBuilder.restore'), icon: <RestoreFromTrash fontSize="small" />, hidden: !archived, onClick: () => void restore(record) },
                            { key: 'remove', label: translate(locale, 'publicPageBuilder.remove'), icon: <Delete fontSize="small" />, hidden: !archived, danger: true, onClick: () => void remove(record) },
                          ]}
                        />
                      );
                    })}
                  </AppList>
                )}
              </>
            )}
          </Stack>
      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{translate(locale, 'publicPageBuilder.pasteJsonTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">{translate(locale, 'publicPageBuilder.pasteJsonHint')}</Typography>
            {pasteError ? <Alert severity="error">{translate(locale, `publicPageBuilder.${pasteError}`)}</Alert> : null}
            <TextField multiline minRows={8} maxRows={16} fullWidth value={pasteText} autoFocus
              placeholder={translate(locale, 'publicPageBuilder.pasteJsonPlaceholder')}
              onChange={(event) => { setPasteText(event.target.value); setPasteError(null); }}
              slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace', fontSize: 12 } } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={isMutating} onClick={() => setPasteOpen(false)}>{translate(locale, 'publicPageBuilder.cancel')}</Button>
          <Button disabled={isMutating || !pasteText.trim()} variant="contained" onClick={() => void importLayout()}>{translate(locale, 'publicPageBuilder.create')}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle>{translate(locale, 'publicPageBuilder.create')}</DialogTitle>
        <DialogContent dividers>
          {mutationError ? (
            <Alert severity="error" sx={{ mb: 2 }}>{mutationErrorText}</Alert>
          ) : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(18rem, 0.8fr) minmax(0, 1.2fr)' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
            <Stack spacing={2}>
              <TextField select fullWidth label={translate(locale, 'publicPageBuilder.template')} value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}>
                {PUBLIC_PAGE_TEMPLATES.map((template) => <MenuItem key={template.id} value={template.id}>{template.names?.[locale] ?? template.name}</MenuItem>)}
              </TextField>
              <Typography id={templatesHeadingId} variant="subtitle2">
                {translate(locale, 'publicPageBuilder.implementedTemplates').replace('{count}', String(PUBLIC_PAGE_TEMPLATES.length))}
              </Typography>
              <Box role="group" aria-labelledby={templatesHeadingId} sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TEMPLATE_CARD_WIDTH + 16}px)`, gap: 'var(--app-space-m)', justifyContent: 'start' }}>
                {PUBLIC_PAGE_TEMPLATES.map((template) => (
                  <TemplateCard key={template.id} template={template} locale={locale} selected={template.id === templateId} onSelect={() => setTemplateId(template.id)} />
                ))}
              </Box>
            </Stack>
            {templatePreview ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">{translate(locale, 'publicPageBuilder.templatePreview')}</Typography>
                <Box inert aria-hidden aria-label={translate(locale, 'publicPageBuilder.templatePreview')} sx={{
                  height: PUBLIC_PAGES_PRESENTATION.createPreviewHeight, overflow: 'auto', border: 1, borderColor: 'divider',
                  borderRadius: 2, bgcolor: 'background.default',
                  '& a, & button, & [role="button"]': { pointerEvents: 'none' },
                }}>
                  <PublicPageRenderer document={templatePreview} />
                </Box>
                <Typography variant="caption" color="text.secondary">{translate(locale, 'publicPageBuilder.templatePreviewHint')}</Typography>
              </Stack>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button disabled={isMutating} variant="contained" onClick={() => void create()}>{translate(locale, 'publicPageBuilder.create')}</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}
