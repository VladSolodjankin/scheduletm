import { Add, Archive, ContentCopy, Delete, Edit, OpenInNew } from '@mui/icons-material';
import {
  Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicPageText } from '../components/public-page-builder/uiText';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import type { PublicPageRecord } from '../features/public-page-builder/repository/PublicPageRepository';
import { createStableId } from '../features/public-page-builder/utils/createStableId';
import type { PublicPageDocument } from '../features/public-page-builder/types/publicPage';
import { getPublicPageTemplate, PUBLIC_PAGE_TEMPLATES } from '../features/public-page-builder/templates';
import { PublicPageRenderer } from '../components/public-page-blocks/PublicPageRenderer';

function cloneDocument(document: PublicPageDocument): PublicPageDocument {
  const id = createStableId();
  const remap = () => createStableId();
  return {
    ...structuredClone(document),
    id,
    slug: `${document.slug.slice(0, 30)}-${id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5)}`,
    status: 'draft',
    sections: document.sections.map((section) => ({
      ...section,
      id: remap(),
      blocks: section.blocks.map((block) => ({ ...block, id: remap() })),
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function PublicPagesPage() {
  const { locale } = useI18n();
  const { accessToken } = useAuth();
  const repository = useMemo(() => new ApiPublicPageRepository(accessToken), [accessToken]);
  const navigate = useNavigate();
  const [records, setRecords] = useState<PublicPageRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [createOpen, setCreateOpen] = useState(false);
  const [templateId, setTemplateId] = useState('blank');
  const [mutationError, setMutationError] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const templatePreview = useMemo(
    () => getPublicPageTemplate(templateId)?.createDocument('template-preview', '2026-01-01T00:00:00.000Z'),
    [templateId],
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
    const document = getPublicPageTemplate(templateId)?.createDocument(createStableId());
    if (!document) {return;}
    setIsMutating(true);
    setMutationError(false);
    try {
      const created = await repository.create(document);
      setCreateOpen(false);
      navigate(`/public-pages/${created.id}/edit`);
    } catch {
      setMutationError(true);
    } finally {
      setIsMutating(false);
    }
  };
  const duplicate = async (record: PublicPageRecord) => {
    setIsMutating(true);
    setMutationError(false);
    try {
      await repository.create(cloneDocument(record.draft));
      await load();
    } catch {
      setMutationError(true);
    } finally {
      setIsMutating(false);
    }
  };
  const archive = async (record: PublicPageRecord) => {
    setIsMutating(true);
    setMutationError(false);
    try {
      await repository.archive(record.id, record.revision);
      await load();
    } catch {
      setMutationError(true);
      await load();
    } finally {
      setIsMutating(false);
    }
  };
  const remove = async (record: PublicPageRecord) => {
    if (!window.confirm(publicPageText(locale, 'deleteConfirm'))) {return;}
    setIsMutating(true);
    setMutationError(false);
    try {
      await repository.delete(record.id, record.revision);
      await load();
    } catch {
      setMutationError(true);
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

  if (status === 'loading') {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label={publicPageText(locale, 'loading')} /></Box>;
  }
  if (status === 'error') {
    return <Alert severity="error" action={<Button onClick={() => void load()}>{publicPageText(locale, 'retry')}</Button>}>{publicPageText(locale, 'saveError')}</Alert>;
  }
  return (
    <Stack spacing={3} sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{publicPageText(locale, 'pages')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>{publicPageText(locale, 'create')}</Button>
      </Stack>
      {mutationError ? (
        <Alert severity="error" action={<Button onClick={() => { setMutationError(false); void load(); }}>{publicPageText(locale, 'retry')}</Button>}>
          {publicPageText(locale, 'saveError')}
        </Alert>
      ) : null}
      {records.length === 0 ? (
        <Card variant="outlined"><CardContent><Typography>{publicPageText(locale, 'empty')}</Typography></CardContent></Card>
      ) : (
        <Grid container spacing={2}>
          {records.map((record) => (
            <Grid key={record.id} size={{ xs: 12, md: 6, xl: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="h6">{record.draft.seo.title || record.draft.slug}</Typography>
                    <Chip size="small" label={statusLabels[record.status]} />
                  </Stack>
                  <Typography color="text.secondary">{['meetli', '.', 'cc', '/', record.draft.slug].join('')}</Typography>
                </CardContent>
                <CardActions>
                  {record.status !== 'archived' ? (
                    <Button startIcon={<Edit />} onClick={() => navigate(`/public-pages/${record.id}/edit`)}>{publicPageText(locale, 'edit')}</Button>
                  ) : null}
                    <Button disabled={isMutating} startIcon={<ContentCopy />} onClick={() => void duplicate(record)}>{publicPageText(locale, 'duplicate')}</Button>
                  {record.status !== 'archived' ? (
                    <Button disabled={isMutating} startIcon={<Archive />} onClick={() => void archive(record)}>{publicPageText(locale, 'archive')}</Button>
                  ) : null}
                  {record.status === 'archived' ? (
                    <Button disabled={isMutating} color="error" startIcon={<Delete />} onClick={() => void remove(record)}>{publicPageText(locale, 'remove')}</Button>
                  ) : null}
                  {record.published ? <Button startIcon={<OpenInNew />} href={`/${record.published.slug}`}>{publicPageText(locale, 'open')}</Button> : null}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{publicPageText(locale, 'create')}</DialogTitle>
        <DialogContent>
          {mutationError ? (
            <Alert severity="error" sx={{ mt: 1 }}>{publicPageText(locale, 'saveError')}</Alert>
          ) : null}
          <TextField select fullWidth sx={{ mt: 1 }} label={publicPageText(locale, 'template')} value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}>
            {PUBLIC_PAGE_TEMPLATES.map((template) => <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>)}
          </TextField>
          {templatePreview ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{publicPageText(locale, 'templatePreview')}</Typography>
              <Box inert aria-label={publicPageText(locale, 'templatePreview')} sx={{
                height: { xs: 360, sm: 440 }, overflow: 'auto', border: 1, borderColor: 'divider',
                borderRadius: 2, bgcolor: 'background.default',
                '& a, & button': { pointerEvents: 'none' },
              }}>
                <PublicPageRenderer document={templatePreview} />
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button disabled={isMutating} variant="contained" onClick={() => void create()}>{publicPageText(locale, 'create')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
