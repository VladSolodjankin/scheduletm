import { Stack } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { NotificationLogItem, NotificationLogsResponse, VerifyEmailResponse } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppButton } from '../shared/ui/AppButton';
import { AppDataTable } from '../shared/ui/AppDataTable';
import { AppFilterBar } from '../shared/ui/AppFilterBar';
import { AppPage } from '../shared/ui/AppPage';
import { AppLoadingState, AppStatusBadge, AppStatusMessage, type AppStatusTone } from '../shared/ui/AppStatus';
import { AppTextField } from '../shared/ui/AppTextField';

type Filters = {
  accountId: string;
  specialistId: string;
  userId: string;
};

const FAILED_STATUSES = new Set(['failed', 'retry', 'cancelled']);

function getStatusTone(status: string): AppStatusTone {
  if (status === 'sent') {
    return 'success';
  }
  if (status === 'retry') {
    return 'warning';
  }
  if (FAILED_STATUSES.has(status)) {
    return 'danger';
  }
  return 'neutral';
}

export function NotificationLogsContainer() {
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationLogItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isResendingId, setIsResendingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    accountId: '',
    specialistId: '',
    userId: '',
  });

  const canViewLogs = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Specialist;

  const loadLogs = useCallback(async () => {
    if (!accessToken || !canViewLogs) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.get<NotificationLogsResponse>('/api/notifications', {
        headers: authHeaders(accessToken),
        params: {
          ...(filters.accountId ? { accountId: Number(filters.accountId) } : {}),
          ...(filters.specialistId ? { specialistId: Number(filters.specialistId) } : {}),
          ...(filters.userId ? { userId: Number(filters.userId) } : {}),
        },
      });

      setItems(response.data.items);
      setError('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('notificationLogs.errors.load'),
        networkMessage: t('common.errors.network'),
      }).message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, canViewLogs, filters.accountId, filters.specialistId, filters.userId, t]);

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

  const resend = async (item: NotificationLogItem) => {
    if (!accessToken) {
      return;
    }

    setIsResendingId(item.id);
    try {
      const response = await apiClient.post<VerifyEmailResponse>(`/api/notifications/${item.id}/resend`, {}, {
        headers: authHeaders(accessToken),
      });
      setSuccess(response.data.message || t('notificationLogs.success.resent'));
      setError('');
      await loadLogs();
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('notificationLogs.errors.resend'),
        networkMessage: t('common.errors.network'),
      }).message);
      setSuccess('');
    } finally {
      setIsResendingId(null);
    }
  };

  return (
    <AppPage title={t('notificationLogs.pageTitle')} subtitle={t('notificationLogs.pageSubtitle')}>
      <Stack spacing={2}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}
        {success ? <AppStatusMessage severity="success" message={success} /> : null}

        {!canViewLogs ? (
          <AppStatusMessage severity="info" message={t('notificationLogs.accessDenied')} />
        ) : (
          <Stack spacing={2}>
            <AppFilterBar
              mobileLabel={t('common.filters')}
              mobileTitle={t('notificationLogs.pageTitle')}
              activeFiltersCount={[filters.accountId, filters.specialistId, filters.userId].filter(Boolean).length}
            >
              {user?.role === WebUserRole.Owner && (
                <AppTextField
                  label={t('notificationLogs.filters.accountId')}
                  value={filters.accountId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, accountId: event.target.value.replace(/\D/g, '') }))}
                />
              )}
              <AppTextField
                label={t('notificationLogs.filters.specialistId')}
                value={filters.specialistId}
                onChange={(event) => setFilters((prev) => ({ ...prev, specialistId: event.target.value.replace(/\D/g, '') }))}
              />
              <AppTextField
                label={t('notificationLogs.filters.userId')}
                value={filters.userId}
                onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value.replace(/\D/g, '') }))}
              />
              <AppButton onClick={() => void loadLogs()}>
                {t('notificationLogs.filters.apply')}
              </AppButton>
            </AppFilterBar>

            {isLoading ? (
              <AppLoadingState lines={3} />
            ) : (
              <AppDataTable
              title=""
              columns={[
                { key: 'id', label: 'ID', width: 72, render: (item) => item.id },
                { key: 'accountId', label: t('notificationLogs.columns.accountId'), width: 96, render: (item) => item.accountId },
                { key: 'specialist', label: t('notificationLogs.columns.specialist'), width: 180, render: (item) => item.specialistName || `#${item.specialistId}` },
                { key: 'client', label: t('notificationLogs.columns.client'), width: 180, render: (item) => item.clientName || `#${item.userId}` },
                { key: 'message', label: t('notificationLogs.columns.message'), width: 260, render: (item) => item.message || '—' },
                { key: 'telegram', label: t('notificationLogs.columns.telegram'), width: 180, render: (item) => item.recipientTelegram || '—' },
                { key: 'email', label: t('notificationLogs.columns.email'), width: 220, render: (item) => item.recipientEmail || '—' },
                { key: 'type', label: t('notificationLogs.columns.type'), width: 160, render: (item) => item.type },
                { key: 'channel', label: t('notificationLogs.columns.channel'), width: 112, render: (item) => item.channel },
                {
                  key: 'status',
                  label: t('notificationLogs.columns.status'),
                  width: 120,
                  render: (item) => <AppStatusBadge label={item.status} tone={getStatusTone(item.status)} />,
                },
                { key: 'attempts', label: t('notificationLogs.columns.attempts'), width: 104, render: (item) => `${item.attempts}/${item.maxAttempts}` },
                { key: 'lastError', label: t('notificationLogs.columns.lastError'), width: 300, render: (item) => item.lastError || '—' },
                { key: 'createdAt', label: t('notificationLogs.columns.createdAt'), width: 200, render: (item) => new Date(item.createdAt).toLocaleString() },
                {
                  key: 'actions',
                  label: t('notificationLogs.columns.actions'),
                  width: 136,
                  render: (item) => (
                    <AppButton
                      variant="outlined"
                      size="small"
                      disabled={!FAILED_STATUSES.has(item.status) || isResendingId === item.id}
                      isLoading={isResendingId === item.id}
                      onClick={() => void resend(item)}
                    >
                      {t('notificationLogs.resend')}
                    </AppButton>
                  ),
                },
              ]}
              rows={items}
              getRowKey={(item) => item.id}
              emptyTitle={t('notificationLogs.empty')}
              />
            )}
          </Stack>
        )}
      </Stack>
    </AppPage>
  );
}
