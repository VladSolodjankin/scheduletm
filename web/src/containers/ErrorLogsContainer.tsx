import { Stack } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { ErrorLogItem, ErrorLogsResponse } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppDataTable } from '../shared/ui/AppDataTable';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppPage } from '../shared/ui/AppPage';
import { AppLoadingState, AppStatusBadge, AppStatusMessage } from '../shared/ui/AppStatus';

export function ErrorLogsContainer() {
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [items, setItems] = useState<ErrorLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const canViewLogs = user?.role === WebUserRole.ProductOwner;

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

    const timeoutId = window.setTimeout(() => {
      void loadLogs();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [accessToken, loadLogs, navigate]);

  return (
    <AppPage title={t('errorLogs.pageTitle')} subtitle={t('errorLogs.pageSubtitle')}>
      <Stack spacing={2}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}

        {!canViewLogs ? (
          <AppStatusMessage severity="info" message={t('errorLogs.accessDenied')} />
        ) : isLoading ? (
          <AppLoadingState lines={3} />
        ) : (
          <AppDataTable
            title=""
            icon={<AppIcons.errors fontSize="small" />}
            columns={[
              {
                key: 'id',
                label: 'ID',
                width: 80,
                render: (item) => item.id
              },
              {
                key: 'createdAt',
                label: t('errorLogs.columns.createdAt'),
                width: 210,
                render: (item) => new Date(item.createdAt).toLocaleString()
              },
              {
                key: 'source',
                label: t('errorLogs.columns.source'),
                width: 120,
                render: (item) => (
                  <AppStatusBadge label={item.source} tone={item.source === 'server' ? 'warning' : 'neutral'} />
                )
              },
              {
                key: 'path',
                label: t('errorLogs.columns.path'),
                width: 260,
                render: (item) => item.path || '-'
              },
              {
                key: 'message',
                label: t('errorLogs.columns.message'),
                width: 420,
                render: (item) => item.message
              },
              {
                key: 'accountId',
                label: t('errorLogs.columns.accountId'),
                width: 120,
                render: (item) => item.accountId ?? '-'
              }
            ]}
            rows={items}
            getRowKey={(item) => item.id}
            emptyTitle={t('errorLogs.empty')}
          />
        )}
      </Stack>
    </AppPage>
  );
}
