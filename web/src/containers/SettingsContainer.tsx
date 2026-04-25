import { Alert, Box, Skeleton, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SettingsCard } from '../components/SettingsCard';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type {
  AccountSettings,
  GoogleOAuthDisconnectResponse,
  GoogleOAuthStartResponse,
  SystemSettings,
  UserSettings,
} from '../shared/types/api';

const defaultSystemSettings: SystemSettings = {
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  refreshTokenTtlDays: 30,
  accessTokenTtlSeconds: 900,
  sessionCookieName: 'meetli_refresh_token',
};

const defaultAccountSettings: AccountSettings = {
  timezone: 'UTC',
  locale: 'ru-RU',
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
};

const defaultUserSettings: UserSettings = {
  timezone: 'UTC',
  locale: 'ru-RU',
  uiThemeMode: 'light',
  uiPaletteVariantId: 'default',
  googleConnected: false,
  telegramBotConnected: false,
  telegramBotName: null,
  telegramBotUsername: null,
  telegramBotToken: '',
};

export function SettingsContainer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(defaultAccountSettings);
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultUserSettings);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isGoogleDisconnecting, setIsGoogleDisconnecting] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const googleOauthStatus = useMemo(() => searchParams.get('google_oauth'), [searchParams]);
  const canManageSystemSettings = user?.role === 'owner';
  const canManageAccountSettings = user?.role === 'owner' || user?.role === 'admin';

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

        if (canManageAccountSettings) {
          const accountResponse = await apiClient.get<AccountSettings>('/api/settings/account', {
            headers: authHeaders(accessToken)
          });
          setAccountSettings(accountResponse.data);
        }

        if (canManageSystemSettings) {
          const systemResponse = await apiClient.get<SystemSettings>('/api/settings/system', {
            headers: authHeaders(accessToken)
          });
          setSystemSettings(systemResponse.data);
        }
      } catch (err) {
        setError(resolveApiError(err, {
          fallbackMessage: t('settings.errors.load'),
          networkMessage: t('common.errors.network')
        }).message);
      } finally {
        setIsLoadingSettings(false);
      }
    };

    void load();
  }, [accessToken, canManageAccountSettings, canManageSystemSettings, navigate, t]);

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
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingSystem(false);
    }
  };

  const saveAccountSettings = async (nextSettings: AccountSettings) => {
    if (!accessToken || !canManageAccountSettings) {
      return;
    }

    setIsSavingAccount(true);

    try {
      const response = await apiClient.put<AccountSettings>('/api/settings/account', nextSettings, {
        headers: authHeaders(accessToken)
      });
      setAccountSettings(response.data);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const saveUserSettings = async (nextSettings: UserSettings) => {
    if (!accessToken) {
      return;
    }

    setIsSavingUser(true);

    try {
      const payload: UserSettings = { ...nextSettings };
      if (!payload.telegramBotToken) {
        delete payload.telegramBotToken;
      }

      const response = await apiClient.put<UserSettings>('/api/settings/user', payload, {
        headers: authHeaders(accessToken)
      });
      setUserSettings(response.data);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingUser(false);
    }
  };

  const clearTelegramBotToken = async () => {
    if (!accessToken) {
      return;
    }

    setIsSavingUser(true);

    try {
      const response = await apiClient.put<UserSettings>(
        '/api/settings/user',
        { telegramBotToken: '' },
        { headers: authHeaders(accessToken) }
      );
      setUserSettings(response.data);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingUser(false);
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
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.connectGoogle'),
        networkMessage: t('common.errors.network')
      }).message);
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
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.disconnectGoogle'),
        networkMessage: t('common.errors.network')
      }).message);
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
            accountSettings={accountSettings}
            userSettings={userSettings}
            canManageSystemSettings={canManageSystemSettings}
            canManageAccountSettings={canManageAccountSettings}
            copy={{
              systemTab: t('settings.tabs.system'),
              accountTab: t('settings.tabs.account'),
              userTab: t('settings.tabs.user'),
              systemTitle: t('settings.systemTitle'),
              accountTitle: t('settings.accountTitle'),
              userTitle: t('settings.userTitle'),
              timezone: t('settings.timezone'),
              locale: t('settings.locale'),
              defaultMeetingDuration: t('settings.defaultMeetingDuration'),
              dailyDigestEnabled: t('settings.dailyDigestEnabled'),
              weekStartsOnMonday: t('settings.weekStartsOnMonday'),
              refreshTokenTtlDays: t('settings.refreshTokenTtlDays'),
              accessTokenTtlSeconds: t('settings.accessTokenTtlSeconds'),
              sessionCookieName: t('settings.sessionCookieName'),
              saveSettings: t('common.saveSettings'),
              integrationsTitle: t('settings.integrationsTitle'),
              integrationsSubtitle: t('settings.integrationsSubtitle'),
              connectGoogle: t('settings.connectGoogle'),
              connectingGoogle: t('settings.connectingGoogle'),
              disconnectGoogle: t('settings.disconnectGoogle'),
              disconnectingGoogle: t('settings.disconnectingGoogle'),
              telegramBotToken: t('settings.telegramBotToken'),
              telegramBotConnected: t('settings.telegramBotConnected'),
              telegramBotNotConnected: t('settings.telegramBotNotConnected'),
              clearTelegramBotToken: t('settings.clearTelegramBotToken')
            }}
            isGoogleConnecting={isGoogleConnecting}
            isGoogleDisconnecting={isGoogleDisconnecting}
            isSavingSystem={isSavingSystem}
            isSavingAccount={isSavingAccount}
            isSavingUser={isSavingUser}
            onSaveSystem={saveSystemSettings}
            onSaveAccount={saveAccountSettings}
            onSaveUser={saveUserSettings}
            onClearTelegramBotToken={clearTelegramBotToken}
            onConnectGoogle={connectGoogle}
            onDisconnectGoogle={disconnectGoogle}
          />
        )}
      </Box>
    </AppPage>
  );
}
