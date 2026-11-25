import { Add, Archive, ContentCopy, ContentPaste, DataObject, Delete, Edit, InsightsOutlined, OpenInNew, RestoreFromTrash } from '@mui/icons-material';
import {
  Alert, Box, Button, ButtonBase, Card, CardActions, CardContent, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicPageText } from '../components/public-page-builder/uiText';
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
  const { locale } = useI18n();
  const { accessToken } = useAuth();
  const pagesHeadingId = useId();
  const templatesHeadingId = useId();
  const repository = useMemo(() => new ApiPublicPageRepository(accessToken), [accessToken]);
  const navigate = useNavigate();
  const [records, setRecords] = useState<PublicPageRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [createOpen, setCreateOpen] = useState(false);
  const [templateId, setTemplateId] = useState('blank');
  const [mutationError, setMutationError] = useState<MutationError | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [copyNotice, setCopyNotice] = useState<'copyJsonDone' | 'copyJsonError' | null>(null);
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
    setCopyNotice(null);
    try {
      await navigator.clipboard.writeText(exportPublicPageLayout(record.draft));
      setCopyNotice('copyJsonDone');
    } catch {
      setCopyNotice('copyJsonError');
    }
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
    if (!window.confirm(publicPageText(locale, 'deleteConfirm'))) {return;}
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
    draft: publicPageText(locale, 'draft'),
    published: publicPageText(locale, 'published'),
    archived: publicPageText(locale, 'archived'),
  }), [locale]);
  const mutationErrorText = mutationError?.action === 'restore'
    ? publicPageText(locale, mutationError.code === 'slug_conflict'
      ? 'restoreSlugConflict'
      : mutationError.code === 'quota_exceeded'
        ? 'restoreQuotaExceeded'
        : mutationError.code === 'revision_conflict'
          ? 'restoreRevisionConflict'
          : mutationError.code === 'page_not_archived'
            ? 'restorePageState'
            : 'restoreError')
    : publicPageText(locale, 'saveError');

  return (
    <Box component="section" aria-labelledby={pagesHeadingId} sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, md: 4 } }}>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
              <Box>
                <Typography id={pagesHeadingId} variant="h4">{publicPageText(locale, 'pages')}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>{publicPageText(locale, 'pagesSubtitle')}</Typography>
              </Box>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                <Button variant="outlined" startIcon={<ContentPaste />} onClick={() => { setPasteError(null); setPasteOpen(true); }}>{publicPageText(locale, 'pasteJson')}</Button>
                <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>{publicPageText(locale, 'create')}</Button>
              </Stack>
            </Stack>
            {copyNotice ? (
              <Alert severity={copyNotice === 'copyJsonDone' ? 'success' : 'error'} onClose={() => setCopyNotice(null)}>{publicPageText(locale, copyNotice)}</Alert>
            ) : null}
            {status === 'loading' ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress aria-label={publicPageText(locale, 'loading')} /></Box>
            ) : status === 'error' ? (
              <Alert severity="error" action={<Button onClick={() => void load()}>{publicPageText(locale, 'retry')}</Button>}>{publicPageText(locale, 'saveError')}</Alert>
            ) : (
              <>
                {mutationError ? (
                  <Alert severity="error" action={<Button onClick={() => { setMutationError(null); void load(); }}>{publicPageText(locale, 'retry')}</Button>}>
                    {mutationErrorText}
                  </Alert>
                ) : null}
                {records.length === 0 ? (
                  <Card variant="outlined"><CardContent><Typography>{publicPageText(locale, 'empty')}</Typography></CardContent></Card>
                ) : (
                  <Grid container spacing={2}>
                    {records.map((record) => (
                      <Grid key={record.id} size={{ xs: 12, md: 6, lg: 4 }}>
                        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <CardContent>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Typography variant="h6">{record.draft.seo.title || record.draft.slug}</Typography>
                              <Chip size="small" label={statusLabels[record.status]} sx={{ flexShrink: 0 }} />
                            </Stack>
                            <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{publicPageDisplayUrl(record.draft.slug)}</Typography>
                          </CardContent>
                          <CardActions sx={{ mt: 'auto', flexWrap: 'wrap', gap: 0.5 }}>
                            {record.status !== 'archived' ? (
                              <Button startIcon={<Edit />} onClick={() => navigate(`/public-pages/${record.id}/edit`)}>{publicPageText(locale, 'edit')}</Button>
                            ) : null}
                            {record.published ? (
                              <Button startIcon={<InsightsOutlined />} onClick={() => navigate(`/public-pages/${record.id}/analytics`)}>{publicPageText(locale, 'analytics')}</Button>
                            ) : null}
                            <Button disabled={isMutating} startIcon={<ContentCopy />} onClick={() => void duplicate(record)}>{publicPageText(locale, 'duplicate')}</Button>
                            <Button startIcon={<DataObject />} onClick={() => void copyLayout(record)}>{publicPageText(locale, 'copyJson')}</Button>
                            {record.status !== 'archived' ? (
                              <Button disabled={isMutating} startIcon={<Archive />} onClick={() => void archive(record)}>{publicPageText(locale, 'archive')}</Button>
                            ) : null}
                            {record.status === 'archived' ? (
                              <Button disabled={isMutating} startIcon={<RestoreFromTrash />} onClick={() => void restore(record)}>{publicPageText(locale, 'restore')}</Button>
                            ) : null}
                            {record.status === 'archived' ? (
                              <Button disabled={isMutating} color="error" startIcon={<Delete />} onClick={() => void remove(record)}>{publicPageText(locale, 'remove')}</Button>
                            ) : null}
                            {record.published ? (
                              <Button startIcon={<OpenInNew />} href={publicPageUrl(record.published.slug)} target="_blank" rel="noopener noreferrer">
                                {publicPageText(locale, 'open')}
                              </Button>
                            ) : null}
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </Stack>
        </Container>
      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{publicPageText(locale, 'pasteJsonTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">{publicPageText(locale, 'pasteJsonHint')}</Typography>
            {pasteError ? <Alert severity="error">{publicPageText(locale, pasteError)}</Alert> : null}
            <TextField multiline minRows={8} maxRows={16} fullWidth value={pasteText} autoFocus
              placeholder={publicPageText(locale, 'pasteJsonPlaceholder')}
              onChange={(event) => { setPasteText(event.target.value); setPasteError(null); }}
              slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace', fontSize: 12 } } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={isMutating} onClick={() => setPasteOpen(false)}>{publicPageText(locale, 'cancel')}</Button>
          <Button disabled={isMutating || !pasteText.trim()} variant="contained" onClick={() => void importLayout()}>{publicPageText(locale, 'create')}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle>{publicPageText(locale, 'create')}</DialogTitle>
        <DialogContent dividers>
          {mutationError ? (
            <Alert severity="error" sx={{ mb: 2 }}>{mutationErrorText}</Alert>
          ) : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(18rem, 0.8fr) minmax(0, 1.2fr)' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
            <Stack spacing={2}>
              <TextField select fullWidth label={publicPageText(locale, 'template')} value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}>
                {PUBLIC_PAGE_TEMPLATES.map((template) => <MenuItem key={template.id} value={template.id}>{template.names?.[locale] ?? template.name}</MenuItem>)}
              </TextField>
              <Typography id={templatesHeadingId} variant="subtitle2">
                {publicPageText(locale, 'implementedTemplates').replace('{count}', String(PUBLIC_PAGE_TEMPLATES.length))}
              </Typography>
              <Box role="group" aria-labelledby={templatesHeadingId} sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TEMPLATE_CARD_WIDTH + 16}px)`, gap: 'var(--app-space-m)', justifyContent: 'start' }}>
                {PUBLIC_PAGE_TEMPLATES.map((template) => (
                  <TemplateCard key={template.id} template={template} locale={locale} selected={template.id === templateId} onSelect={() => setTemplateId(template.id)} />
                ))}
              </Box>
            </Stack>
            {templatePreview ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">{publicPageText(locale, 'templatePreview')}</Typography>
                <Box inert aria-hidden aria-label={publicPageText(locale, 'templatePreview')} sx={{
                  height: PUBLIC_PAGES_PRESENTATION.createPreviewHeight, overflow: 'auto', border: 1, borderColor: 'divider',
                  borderRadius: 2, bgcolor: 'background.default',
                  '& a, & button, & [role="button"]': { pointerEvents: 'none' },
                }}>
                  <PublicPageRenderer document={templatePreview} />
                </Box>
                <Typography variant="caption" color="text.secondary">{publicPageText(locale, 'templatePreviewHint')}</Typography>
              </Stack>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button disabled={isMutating} variant="contained" onClick={() => void create()}>{publicPageText(locale, 'create')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
