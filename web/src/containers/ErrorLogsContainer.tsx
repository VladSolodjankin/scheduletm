import { Alert, Card, CardContent, Chip, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { ErrorLogItem, ErrorLogsResponse } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppPage } from '../shared/ui/AppPage';

export function ErrorLogsContainer() {
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [items, setItems] = useState<ErrorLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const canViewLogs = user?.role === WebUserRole.Owner;

  const loadLogs = useCallback(async () => {
    if (!accessToken || !canViewLogs) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.get<ErrorLogsResponse>('/api/error-logs', {
        headers: authHeaders(accessToken),
      });
      setItems(response.data.items);
      setError('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('errorLogs.errors.load'),
        networkMessage: t('common.errors.network'),
      }).message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, canViewLogs, t]);

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    void loadLogs();
  }, [accessToken, loadLogs, navigate]);

  return (
    <AppPage title={t('errorLogs.pageTitle')} subtitle={t('errorLogs.pageSubtitle')}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!canViewLogs ? (
        <Alert severity="info">{t('errorLogs.accessDenied')}</Alert>
      ) : (
        <Card>
          <CardContent>
            {isLoading ? (
              <Stack spacing={2}>
                <Skeleton variant="rounded" height={40} />
                <Skeleton variant="rounded" height={240} />
              </Stack>
            ) : items.length === 0 ? (
              <Typography color="text.secondary">{t('errorLogs.empty')}</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>{t('errorLogs.columns.createdAt')}</TableCell>
                    <TableCell>{t('errorLogs.columns.source')}</TableCell>
                    <TableCell>{t('errorLogs.columns.path')}</TableCell>
                    <TableCell>{t('errorLogs.columns.message')}</TableCell>
                    <TableCell>{t('errorLogs.columns.accountId')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip size="small" label={item.source} color={item.source === 'server' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell>{item.path || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 420 }}>{item.message}</TableCell>
                      <TableCell>{item.accountId ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppPage>
  );
}
