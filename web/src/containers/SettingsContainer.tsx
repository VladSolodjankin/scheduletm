import { Alert, Box, Skeleton, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SettingsCard } from '../components/SettingsCard';
import { SpecialistFormDialog } from '../components/specialists/SpecialistFormDialog';
import { SpecialistsTable } from '../components/specialists/SpecialistsTable';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type {
  GoogleOAuthDisconnectResponse,
  GoogleOAuthStartResponse,
  SpecialistsListResponse,
  SpecialistManagementItem,
  SystemSettings,
  UserSettings,
} from '../shared/types/api';

const defaultSystemSettings: SystemSettings = {
  timezone: 'UTC',
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  locale: 'ru-RU',
};

const defaultUserSettings: UserSettings = {
  timezone: 'UTC',
  locale: 'ru-RU',
  uiThemeMode: 'light',
  uiPaletteVariantId: 'default',
  googleConnected: false,
};

export function SettingsContainer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultUserSettings);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isGoogleDisconnecting, setIsGoogleDisconnecting] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [specialists, setSpecialists] = useState<SpecialistManagementItem[]>([]);
  const [isSpecialistDialogOpen, setIsSpecialistDialogOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<SpecialistManagementItem | null>(null);
  const [isSavingSpecialist, setIsSavingSpecialist] = useState(false);

  const googleOauthStatus = useMemo(() => searchParams.get('google_oauth'), [searchParams]);
  const canManageSystemSettings = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    if (!googleOauthStatus) {
      return;
    }

    if (googleOauthStatus === 'success') {
      setSuccess(t('settings.googleConnectedSuccessfully'));
      setUserSettings((prev) => ({ ...prev, googleConnected: true }));
      setError('');
    }

    if (googleOauthStatus === 'error') {
      setError(t('settings.errors.connectGoogle'));
      setSuccess('');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('google_oauth');
    nextParams.delete('reason');
    setSearchParams(nextParams, { replace: true });
  }, [googleOauthStatus, searchParams, setSearchParams, t]);

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    const load = async () => {
      setIsLoadingSettings(true);

      try {
        const userResponse = await apiClient.get<UserSettings>('/api/settings/user', {
          headers: authHeaders(accessToken)
        });
        setUserSettings(userResponse.data);

        if (canManageSystemSettings) {
          const specialistsResponse = await apiClient.get<SpecialistsListResponse>('/api/specialists', {
            headers: authHeaders(accessToken)
          });
          setSpecialists(specialistsResponse.data.specialists);

          const systemResponse = await apiClient.get<SystemSettings>('/api/settings/system', {
            headers: authHeaders(accessToken)
          });
          setSystemSettings(systemResponse.data);
        }
      } catch {
        setError(t('settings.errors.load'));
      } finally {
        setIsLoadingSettings(false);
      }
    };

    void load();
  }, [accessToken, canManageSystemSettings, navigate, t]);

  const saveSystemSettings = async (nextSettings: SystemSettings) => {
    if (!accessToken || !canManageSystemSettings) {
      return;
    }

    setIsSavingSystem(true);

    try {
      const response = await apiClient.put<SystemSettings>('/api/settings/system', nextSettings, {
        headers: authHeaders(accessToken)
      });
      setSystemSettings(response.data);
      setError('');
      setSuccess('');
    } catch {
      setError(t('settings.errors.save'));
      setSuccess('');
    } finally {
      setIsSavingSystem(false);
    }
  };

  const saveUserSettings = async (nextSettings: UserSettings) => {
    if (!accessToken) {
      return;
    }

    setIsSavingUser(true);

    try {
      const response = await apiClient.put<UserSettings>('/api/settings/user', nextSettings, {
        headers: authHeaders(accessToken)
      });
      setUserSettings(response.data);
      setError('');
      setSuccess('');
    } catch {
      setError(t('settings.errors.save'));
      setSuccess('');
    } finally {
      setIsSavingUser(false);
    }
  };


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

  const saveSpecialist = async (payload: { name: string; isActive: boolean }) => {
    if (!accessToken) {
      return;
    }

    setIsSavingSpecialist(true);

    try {
      if (editingSpecialist) {
        const response = await apiClient.patch<SpecialistManagementItem>(`/api/specialists/${editingSpecialist.id}`, payload, {
          headers: authHeaders(accessToken),
        });

        setSpecialists((prev) => prev.map((item) => (item.id === response.data.id ? response.data : item)));
      } else {
        const response = await apiClient.post<SpecialistManagementItem>('/api/specialists', { name: payload.name }, {
          headers: authHeaders(accessToken),
        });

        setSpecialists((prev) => [...prev, response.data].sort((left, right) => left.name.localeCompare(right.name)));
      }

      setError('');
      setSuccess('');
      setIsSpecialistDialogOpen(false);
      setEditingSpecialist(null);
    } catch {
      setError(t('settings.errors.saveSpecialist'));
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
    } catch {
      setError(t('settings.errors.deleteSpecialist'));
      setSuccess('');
    }
  };

  const connectGoogle = async () => {
    if (!accessToken || isGoogleConnecting) {
      return;
    }

    setIsGoogleConnecting(true);

    try {
      const response = await apiClient.post<GoogleOAuthStartResponse>(
        '/api/integrations/google/oauth/start',
        {},
        { headers: authHeaders(accessToken) }
      );

      window.location.assign(response.data.authorizeUrl);
    } catch {
      setError(t('settings.errors.connectGoogle'));
      setSuccess('');
      setIsGoogleConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!accessToken || isGoogleDisconnecting) {
      return;
    }

    setIsGoogleDisconnecting(true);

    try {
      await apiClient.post<GoogleOAuthDisconnectResponse>(
        '/api/integrations/google/disconnect',
        {},
        { headers: authHeaders(accessToken) }
      );
      setUserSettings((prev) => ({ ...prev, googleConnected: false }));
      setError('');
      setSuccess('');
    } catch {
      setError(t('settings.errors.disconnectGoogle'));
      setSuccess('');
    } finally {
      setIsGoogleDisconnecting(false);
    }
  };

  return (
    <AppPage title={t('settings.pageTitle')} subtitle={t('settings.pageSubtitle')}>
      {error && (
        <Box sx={{ maxWidth: 720, mb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {success && (
        <Box sx={{ maxWidth: 720, mb: 2 }}>
          <Alert severity="success">{success}</Alert>
        </Box>
      )}

      <Box sx={{ maxWidth: 720 }}>
        {isLoadingSettings ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={42} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={46} width={180} />
          </Stack>
        ) : (
          <SettingsCard
            systemSettings={systemSettings}
            userSettings={userSettings}
            canManageSystemSettings={canManageSystemSettings}
            copy={{
              systemTab: t('settings.tabs.system'),
              userTab: t('settings.tabs.user'),
              systemTitle: t('settings.systemTitle'),
              userTitle: t('settings.userTitle'),
              timezone: t('settings.timezone'),
              locale: t('settings.locale'),
              defaultMeetingDuration: t('settings.defaultMeetingDuration'),
              dailyDigestEnabled: t('settings.dailyDigestEnabled'),
              weekStartsOnMonday: t('settings.weekStartsOnMonday'),
              saveSettings: t('common.saveSettings'),
              integrationsTitle: t('settings.integrationsTitle'),
              integrationsSubtitle: t('settings.integrationsSubtitle'),
              connectGoogle: t('settings.connectGoogle'),
              connectingGoogle: t('settings.connectingGoogle'),
              disconnectGoogle: t('settings.disconnectGoogle'),
              disconnectingGoogle: t('settings.disconnectingGoogle'),
              googleConnected: t('settings.googleConnected')
            }}
            isGoogleConnecting={isGoogleConnecting}
            isGoogleDisconnecting={isGoogleDisconnecting}
            isSavingSystem={isSavingSystem}
            isSavingUser={isSavingUser}
            onSaveSystem={saveSystemSettings}
            onSaveUser={saveUserSettings}
            onConnectGoogle={connectGoogle}
            onDisconnectGoogle={disconnectGoogle}
          />
        )}
      </Box>

      {canManageSystemSettings && !isLoadingSettings && (
        <Box sx={{ maxWidth: 900, mt: 3 }}>
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
        onClose={closeSpecialistDialog}
        onSubmit={saveSpecialist}
      />
    </AppPage>
  );
}
