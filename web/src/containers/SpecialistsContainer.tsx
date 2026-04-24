import { Alert, Box, Skeleton, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpecialistFormDialog } from '../components/specialists/SpecialistFormDialog';
import { SpecialistsTable } from '../components/specialists/SpecialistsTable';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type { SpecialistsListResponse, SpecialistManagementItem } from '../shared/types/api';

export function SpecialistsContainer() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [specialists, setSpecialists] = useState<SpecialistManagementItem[]>([]);
  const [availableWebUsers, setAvailableWebUsers] = useState<Array<{ id: number; email: string }>>([]);
  const [isSpecialistDialogOpen, setIsSpecialistDialogOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<SpecialistManagementItem | null>(null);
  const [isSavingSpecialist, setIsSavingSpecialist] = useState(false);

  const canManageSpecialists = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    if (!canManageSpecialists) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<SpecialistsListResponse>('/api/specialists', {
          headers: authHeaders(accessToken),
        });
        setSpecialists(response.data.specialists);
        setAvailableWebUsers(response.data.availableWebUsers ?? []);
      } catch (err) {
        setError(resolveApiError(err, {
          fallbackMessage: t('settings.errors.load'),
          networkMessage: t('common.errors.network')
        }).message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [accessToken, canManageSpecialists, navigate, t]);

  const openCreateSpecialistDialog = () => {
    setEditingSpecialist(null);
    setIsSpecialistDialogOpen(true);
  };

  const openEditSpecialistDialog = (specialist: SpecialistManagementItem) => {
    setEditingSpecialist(specialist);
    setIsSpecialistDialogOpen(true);
  };

  const closeSpecialistDialog = () => {
    if (isSavingSpecialist) {
      return;
    }

    setIsSpecialistDialogOpen(false);
    setEditingSpecialist(null);
  };

  const saveSpecialist = async (payload: { userId?: number; name?: string; isActive: boolean }) => {
    if (!accessToken) {
      return;
    }

    setIsSavingSpecialist(true);

    try {
      if (editingSpecialist) {
        const response = await apiClient.patch<SpecialistManagementItem>(`/api/specialists/${editingSpecialist.id}`, {
          name: payload.name,
          isActive: payload.isActive,
        }, {
          headers: authHeaders(accessToken),
        });

        setSpecialists((prev) => prev.map((item) => (item.id === response.data.id ? response.data : item)));
      } else {
        if (!payload.userId) {
          return;
        }

        const response = await apiClient.post<SpecialistManagementItem>('/api/specialists', { userId: payload.userId }, {
          headers: authHeaders(accessToken),
        });

        setSpecialists((prev) => [...prev, response.data].sort((left, right) => left.name.localeCompare(right.name)));
        setAvailableWebUsers((prev) => prev.filter((item) => item.id !== payload.userId));
      }

      setError('');
      setSuccess('');
      setIsSpecialistDialogOpen(false);
      setEditingSpecialist(null);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.saveSpecialist'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingSpecialist(false);
    }
  };

  const deleteSpecialist = async (specialist: SpecialistManagementItem) => {
    if (!accessToken) {
      return;
    }

    try {
      await apiClient.delete(`/api/specialists/${specialist.id}`, {
        headers: authHeaders(accessToken),
      });
      setSpecialists((prev) => prev.filter((item) => item.id !== specialist.id));
      setError('');
      setSuccess('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.deleteSpecialist'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    }
  };

  return (
    <AppPage title={t('specialists.pageTitle')} subtitle={t('specialists.pageSubtitle')}>
      {error && (
        <Box sx={{ maxWidth: 900, mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {success && (
        <Box sx={{ maxWidth: 900, mb: 2 }}>
          <Alert severity="success">{success}</Alert>
        </Box>
      )}

      {!canManageSpecialists ? (
        <Box sx={{ maxWidth: 900 }}>
          <Alert severity="info">{t('specialists.accessDenied')}</Alert>
        </Box>
      ) : (
        <Box sx={{ maxWidth: 900 }}>
          {isLoading ? (
            <Stack spacing={2}>
              <Skeleton variant="rounded" height={42} />
              <Skeleton variant="rounded" height={260} />
            </Stack>
          ) : (
            <SpecialistsTable
              title={t('settings.specialists.title')}
              addLabel={t('settings.specialists.add')}
              editLabel={t('settings.specialists.edit')}
              deleteLabel={t('settings.specialists.delete')}
              emptyText={t('settings.specialists.empty')}
              columns={{
                name: t('settings.specialists.columns.name'),
                timezone: t('settings.specialists.columns.timezone'),
                active: t('settings.specialists.columns.active'),
                actions: t('settings.specialists.columns.actions'),
              }}
              specialists={specialists}
              onAdd={openCreateSpecialistDialog}
              onEdit={openEditSpecialistDialog}
              onDelete={(item) => void deleteSpecialist(item)}
            />
          )}
        </Box>
      )}

      <SpecialistFormDialog
        open={isSpecialistDialogOpen}
        isSaving={isSavingSpecialist}
        editingSpecialist={editingSpecialist}
        title={editingSpecialist ? t('settings.specialists.editDialogTitle') : t('settings.specialists.addDialogTitle')}
        saveLabel={t('appointments.save')}
        closeLabel={t('appointments.close')}
        nameLabel={t('settings.specialists.columns.name')}
        activeLabel={t('settings.specialists.columns.active')}
        availableWebUsers={availableWebUsers}
        onClose={closeSpecialistDialog}
        onSubmit={saveSpecialist}
      />
    </AppPage>
  );
}
