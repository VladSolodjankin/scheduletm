import { Alert, Box, Skeleton, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserFormDialog } from '../components/users/UserFormDialog';
import { UsersTable } from '../components/users/UsersTable';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type { ManagedUserItem, ManagedUsersListResponse } from '../shared/types/api';

export function UsersContainer() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<ManagedUserItem[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUserItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const canManageUsers = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    if (!canManageUsers) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<ManagedUsersListResponse>('/api/users', {
          headers: authHeaders(accessToken),
        });
        setUsers(response.data.users);
      } catch (err) {
        setError(resolveApiError(err, {
          fallbackMessage: t('users.errors.load'),
          networkMessage: t('common.errors.network')
        }).message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [accessToken, canManageUsers, navigate, t]);

  const saveUser = async (payload: { email: string; role: 'admin' | 'specialist'; firstName: string; lastName: string; phone?: string; telegramUsername?: string }) => {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        const response = await apiClient.patch<ManagedUserItem>(`/api/users/${editingUser.id}`, payload, {
          headers: authHeaders(accessToken),
        });
        setUsers((prev) => prev.map((item) => (item.id === response.data.id ? response.data : item)));
      } else {
        const response = await apiClient.post<ManagedUserItem>('/api/users', payload, {
          headers: authHeaders(accessToken),
        });
        setUsers((prev) => [response.data, ...prev]);
      }

      setError('');
      setIsDialogOpen(false);
      setEditingUser(null);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('users.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (item: ManagedUserItem) => {
    if (!accessToken) {
      return;
    }

    try {
      const response = await apiClient.delete<ManagedUserItem>(`/api/users/${item.id}`, {
        headers: authHeaders(accessToken),
      });
      setUsers((prev) => prev.map((userItem) => (userItem.id === response.data.id ? response.data : userItem)));
      setError('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('users.errors.delete'),
        networkMessage: t('common.errors.network')
      }).message);
    }
  };

  return (
    <AppPage title={t('users.pageTitle')} subtitle={t('users.pageSubtitle')}>
      {error && (
        <Box sx={{ maxWidth: 1100, mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {!canManageUsers ? (
        <Box sx={{ maxWidth: 900 }}>
          <Alert severity="info">{t('users.accessDenied')}</Alert>
        </Box>
      ) : (
        <Box sx={{ maxWidth: 1100 }}>
          {isLoading ? (
            <Stack spacing={2}>
              <Skeleton variant="rounded" height={42} />
              <Skeleton variant="rounded" height={260} />
            </Stack>
          ) : (
            <UsersTable
              title={t('users.tableTitle')}
              emptyText={t('users.empty')}
              addLabel={t('users.add')}
              editLabel={t('users.edit')}
              deleteLabel={t('users.delete')}
              users={users}
              onAdd={() => {
                setEditingUser(null);
                setIsDialogOpen(true);
              }}
              onEdit={(item) => {
                setEditingUser(item);
                setIsDialogOpen(true);
              }}
              onDelete={(item) => void deleteUser(item)}
            />
          )}
        </Box>
      )}

      <UserFormDialog
        open={isDialogOpen}
        isSaving={isSaving}
        editingUser={editingUser}
        onClose={() => {
          if (!isSaving) {
            setIsDialogOpen(false);
            setEditingUser(null);
          }
        }}
        onSubmit={saveUser}
      />
    </AppPage>
  );
}
