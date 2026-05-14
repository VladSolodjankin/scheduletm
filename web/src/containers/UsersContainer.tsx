import { Box, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserFormDialog } from '../components/users/UserFormDialog';
import { UsersTable } from '../components/users/UsersTable';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppPage } from '../shared/ui/AppPage';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import type { ManagedUserDeleteImpact, ManagedUserItem, ManagedUsersListResponse, VerifyEmailResponse } from '../shared/types/api';

export function UsersContainer() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingInviteForUserId, setIsResendingInviteForUserId] = useState<number | null>(null);
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState<ManagedUserItem[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUserItem | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<ManagedUserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUserItem | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<ManagedUserDeleteImpact | null>(null);
  const [isDeleteImpactLoading, setIsDeleteImpactLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const canManageUsers = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'specialist';
  const isLoading = canManageUsers && isUsersLoading;

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    if (!canManageUsers) {
      return;
    }

    const load = async () => {
      setIsUsersLoading(true);
      try {
        const response = await apiClient.get<ManagedUsersListResponse>('/api/users', {
          headers: authHeaders(accessToken),
        });
        setUsers(response.data.users);
        setSuccess('');
      } catch (err) {
        setError(resolveApiError(err, {
          fallbackMessage: t('users.errors.load'),
          networkMessage: t('common.errors.network')
        }).message);
      } finally {
        setIsUsersLoading(false);
      }
    };

    void load();
  }, [accessToken, canManageUsers, navigate, t]);

  const saveUser = async (payload: { email: string; role: 'admin' | 'specialist' | 'client'; firstName: string; lastName: string; phone?: string; telegramUsername?: string }) => {
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
      setSuccess('');
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

  const deactivateUser = async (item: ManagedUserItem) => {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiClient.post<ManagedUserItem>(`/api/users/${item.id}/deactivate`, {}, {
        headers: authHeaders(accessToken),
      });
      setUsers((prev) => prev.map((userItem) => (userItem.id === response.data.id ? response.data : userItem)));
      setError('');
      setSuccess('');
      setDeactivatingUser(null);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('users.errors.deactivate'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = async (item: ManagedUserItem) => {
    if (!accessToken) {
      return;
    }

    setDeletingUser(item);
    setDeleteImpact(null);
    setIsDeleteImpactLoading(true);
    try {
      const response = await apiClient.get<ManagedUserDeleteImpact>(`/api/users/${item.id}/delete-impact`, {
        headers: authHeaders(accessToken),
      });
      setDeleteImpact(response.data);
      setError('');
    } catch (err) {
      setDeletingUser(null);
      setError(resolveApiError(err, {
        fallbackMessage: t('users.errors.deleteImpact'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsDeleteImpactLoading(false);
    }
  };

  const deleteUser = async (item: ManagedUserItem) => {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.delete<ManagedUserDeleteImpact>(`/api/users/${item.id}`, {
        headers: authHeaders(accessToken),
      });
      setUsers((prev) => prev.filter((userItem) => userItem.id !== item.id));
      setError('');
      setSuccess('');
      setDeletingUser(null);
      setDeleteImpact(null);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('users.errors.delete'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsSaving(false);
    }
  };

  const resendInvite = async (item: ManagedUserItem) => {
    if (!accessToken) {
      return;
    }

    setIsResendingInviteForUserId(item.id);
    try {
      const response = await apiClient.post<VerifyEmailResponse>(`/api/users/${item.id}/resend-invite`, {}, {
        headers: authHeaders(accessToken),
      });
      setError('');
      setSuccess(response.data.message || t('users.success.inviteResent'));
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('users.errors.inviteResend'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsResendingInviteForUserId(null);
    }
  };

  return (
    <AppPage
      title={t('users.pageTitle')}
      subtitle={t('users.pageSubtitle')}
      action={canManageUsers ? (
        <AppButton
          size="small"
          onClick={() => {
            setEditingUser(null);
            setIsDialogOpen(true);
          }}
          startIcon={<AppIcons.add />}
        >
          {t('users.add')}
        </AppButton>
      ) : null}
    >
      <Stack spacing={2.5}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}
        {success ? <AppStatusMessage severity="success" message={success} /> : null}

        {!canManageUsers ? (
          <AppEmptyState title={t('users.accessDenied')} />
        ) : (
          <Box>
            {isLoading ? (
              <AppLoadingState lines={2} />
            ) : (
              <UsersTable
                emptyText={t('users.empty')}
                editLabel={t('users.edit')}
                deactivateLabel={t('users.deactivate')}
                deleteLabel={t('users.delete')}
                resendInviteLabel={t('users.resendInvite')}
                emailColumnLabel={t('users.columns.email')}
                firstNameColumnLabel={t('users.columns.firstName')}
                lastNameColumnLabel={t('users.columns.lastName')}
                roleColumnLabel={t('users.columns.role')}
                verifiedColumnLabel={t('users.columns.verified')}
                activeColumnLabel={t('users.columns.active')}
                actionsColumnLabel={t('users.columns.actions')}
                users={users}
                onEdit={(item) => {
                  setEditingUser(item);
                  setIsDialogOpen(true);
                }}
                onDeactivate={(item) => setDeactivatingUser(item)}
                onDelete={(item) => void openDeleteDialog(item)}
                onResendInvite={(item) => void resendInvite(item)}
                isResendingInviteForUserId={isResendingInviteForUserId}
              />
            )}
          </Box>
        )}
      </Stack>

      <UserFormDialog
        open={isDialogOpen}
        isSaving={isSaving}
        editingUser={editingUser}
        title={editingUser ? t('users.form.editTitle') : t('users.form.addTitle')}
        emailLabel={t('users.form.email')}
        roleLabel={t('users.form.role')}
        firstNameLabel={t('users.form.firstName')}
        lastNameLabel={t('users.form.lastName')}
        phoneLabel={t('users.form.phone')}
        telegramLabel={t('users.form.telegram')}
        closeLabel={t('users.close')}
        saveLabel={t('users.save')}
        adminConfirmTitle={t('users.adminConfirm.title')}
        adminConfirmDescription={t('users.adminConfirm.description')}
        adminConfirmCancelLabel={t('users.adminConfirm.cancel')}
        adminConfirmSubmitLabel={t('users.adminConfirm.confirm')}
        onClose={() => {
          if (!isSaving) {
            setIsDialogOpen(false);
            setEditingUser(null);
          }
        }}
        onSubmit={saveUser}
      />

      <AppConfirmDialog
        open={Boolean(deactivatingUser)}
        onClose={() => !isSaving && setDeactivatingUser(null)}
        title={t('users.deactivateConfirm.title')}
        description={t('users.deactivateConfirm.description')}
        cancelLabel={t('users.deactivateConfirm.cancel')}
        confirmLabel={t('users.deactivateConfirm.confirm')}
        isLoading={isSaving}
        onCancel={() => setDeactivatingUser(null)}
        onConfirm={() => {
          if (deactivatingUser) {
            void deactivateUser(deactivatingUser);
          }
        }}
      />

      <AppConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => !isSaving && setDeletingUser(null)}
        title={t('users.deleteConfirm.title')}
        description={t('users.deleteConfirm.description')}
        cancelLabel={t('users.deleteConfirm.cancel')}
        confirmLabel={t('users.deleteConfirm.confirm')}
        confirmColor="error"
        isLoading={isSaving}
        disabled={isDeleteImpactLoading}
        onCancel={() => {
          setDeletingUser(null);
          setDeleteImpact(null);
        }}
        onConfirm={() => {
          if (deletingUser) {
            void deleteUser(deletingUser);
          }
        }}
      >
        {isDeleteImpactLoading ? (
          <AppLoadingState lines={1} hasHeader={false} />
        ) : deleteImpact ? (
          <Stack spacing={0.75}>
            <Typography variant="body2">
              {t('users.deleteConfirm.totalAppointments').replace('{count}', String(deleteImpact.totalAppointmentCount))}
            </Typography>
            <Typography variant="body2">
              {t('users.deleteConfirm.specialistAppointments').replace('{count}', String(deleteImpact.specialistAppointmentCount))}
            </Typography>
            <Typography variant="body2">
              {t('users.deleteConfirm.clientAppointments').replace('{count}', String(deleteImpact.clientAppointmentCount))}
            </Typography>
            {deleteImpact.hasAppointments ? (
              <Typography variant="body2" color="warning.main">
                {t('users.deleteConfirm.warningHasAppointments')}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </AppConfirmDialog>
    </AppPage>
  );
}
