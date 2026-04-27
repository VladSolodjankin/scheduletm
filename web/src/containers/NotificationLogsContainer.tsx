import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { NotificationLogItem, NotificationLogsResponse, VerifyEmailResponse } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppPage } from '../shared/ui/AppPage';

type Filters = {
  accountId: string;
  specialistId: string;
  userId: string;
};

const FAILED_STATUSES = new Set(['failed', 'retry', 'cancelled']);

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

  const canViewLogs = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin || user?.role === WebUserRole.Specialist;

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

    void loadLogs();
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
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {!canViewLogs ? (
        <Alert severity="info">{t('notificationLogs.accessDenied')}</Alert>
      ) : (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                {user?.role === WebUserRole.Owner && (
                  <TextField
                    label={t('notificationLogs.filters.accountId')}
                    value={filters.accountId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, accountId: event.target.value.replace(/\D/g, '') }))}
                    size="small"
                  />
                )}
                <TextField
                  label={t('notificationLogs.filters.specialistId')}
                  value={filters.specialistId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, specialistId: event.target.value.replace(/\D/g, '') }))}
                  size="small"
                />
                <TextField
                  label={t('notificationLogs.filters.userId')}
                  value={filters.userId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value.replace(/\D/g, '') }))}
                  size="small"
                />
                <Button variant="contained" onClick={() => void loadLogs()}>{t('notificationLogs.filters.apply')}</Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              {isLoading ? (
                <Stack spacing={2}>
                  <Skeleton variant="rounded" height={40} />
                  <Skeleton variant="rounded" height={220} />
                </Stack>
              ) : items.length === 0 ? (
                <Typography color="text.secondary">{t('notificationLogs.empty')}</Typography>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>{t('notificationLogs.columns.accountId')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.specialist')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.client')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.message')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.telegram')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.email')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.type')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.channel')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.status')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.attempts')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.lastError')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.createdAt')}</TableCell>
                        <TableCell>{t('notificationLogs.columns.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.accountId}</TableCell>
                          <TableCell>{item.specialistName || `#${item.specialistId}`}</TableCell>
                          <TableCell>{item.clientName || `#${item.userId}`}</TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>{item.message || '—'}</TableCell>
                          <TableCell>{item.recipientTelegram || '—'}</TableCell>
                          <TableCell>{item.recipientEmail || '—'}</TableCell>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>{item.channel}</TableCell>
                          <TableCell>
                            <Chip label={item.status} size="small" color={item.status === 'sent' ? 'success' : 'default'} />
                          </TableCell>
                          <TableCell>{item.attempts}/{item.maxAttempts}</TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>{item.lastError || '—'}</TableCell>
                          <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="outlined"
                              size="small"
                              disabled={!FAILED_STATUSES.has(item.status) || isResendingId === item.id}
                              onClick={() => void resend(item)}
                            >
                              {t('notificationLogs.resend')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </AppPage>
  );
}
