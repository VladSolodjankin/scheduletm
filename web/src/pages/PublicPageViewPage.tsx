import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PublicPageRenderer } from '../components/public-page-blocks/PublicPageRenderer';
import { publicPageText } from '../components/public-page-builder/uiText';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import { PublicPageRepositoryError } from '../features/public-page-builder/repository/PublicPageRepository';
import type { PublicPageDocument } from '../features/public-page-builder/types/publicPage';
import { useI18n } from '../shared/i18n/I18nContext';

const repository = new ApiPublicPageRepository('');

export function PublicPageViewPage() {
  const { slug = '' } = useParams();
  const { locale } = useI18n();
  const [page, setPage] = useState<PublicPageDocument | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'unavailable'>('loading');
  const load = useCallback(async () => {
    try {
      const document = await repository.getBySlug(slug);
      if (document.status !== 'published') {
        setStatus('unavailable');
        return;
      }
      setPage(document);
      setStatus('ready');
    } catch (error) {
      setStatus(error instanceof PublicPageRepositoryError && error.code === 'not_found' ? 'not-found' : 'unavailable');
    }
  }, [slug]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (status === 'loading') {return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;}
  if (status !== 'ready' || !page) {
    return <Alert severity="info" action={<Button onClick={() => void load()}>{publicPageText(locale, 'retry')}</Button>}>{publicPageText(locale, status === 'not-found' ? 'notFound' : 'unavailable')}</Alert>;
  }
  return <PublicPageRenderer document={page} />;
}
