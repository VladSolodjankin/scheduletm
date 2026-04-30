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
  AccountNotificationDefault,
  AccountSettings,
  GoogleOAuthDisconnectResponse,
  GoogleOAuthStartResponse,
  ZoomOAuthStartResponse,
  SpecialistBookingPolicy,
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
  firstName: '',
  lastName: '',
  phone: '',
  telegramUsername: '',
  uiThemeMode: 'light',
  uiPaletteVariantId: 'default',
  googleConnected: false,
  zoomConnected: false,
  telegramBotConnected: false,
  telegramBotName: null,
  telegramBotUsername: null,
  telegramBotToken: '',
};

const defaultSpecialistBookingPolicy: SpecialistBookingPolicy = {
  specialistId: 0,
  cancelGracePeriodHours: 24,
  refundOnLateCancel: false,
  autoCancelUnpaidEnabled: false,
  unpaidAutoCancelAfterHours: 72,
};

const defaultAccountNotificationDefaults: AccountNotificationDefault[] = [];

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
  const [isZoomConnecting, setIsZoomConnecting] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingSpecialistPolicy, setIsSavingSpecialistPolicy] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [specialistBookingPolicy, setSpecialistBookingPolicy] = useState<SpecialistBookingPolicy>(defaultSpecialistBookingPolicy);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | null>(null);
  const [accountNotificationDefaults, setAccountNotificationDefaults] = useState<AccountNotificationDefault[]>(defaultAccountNotificationDefaults);
  const [isSavingNotificationDefaults, setIsSavingNotificationDefaults] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [passwordStep, setPasswordStep] = useState<'password' | 'otp'>('password');

  const googleOauthStatus = useMemo(() => searchParams.get('google_oauth'), [searchParams]);
  const zoomOauthStatus = useMemo(() => searchParams.get('zoom_oauth'), [searchParams]);
  const canManageSystemSettings = user?.role === 'owner';
  const canManageAccountSettings = user?.role === 'owner' || user?.role === 'admin';
  const canManageSpecialistBookingPolicy =
    user?.role === 'owner' || user?.role === 'admin' || user?.role === 'specialist';

  useEffect(() => {
    if (!googleOauthStatus && !zoomOauthStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (googleOauthStatus === 'success') {
        setSuccess(t('settings.googleConnectedSuccessfully'));
        setUserSettings((prev) => ({ ...prev, googleConnected: true }));
        setError('');
      }

      if (googleOauthStatus === 'error') {
        setError(t('settings.errors.connectGoogle'));
        setSuccess('');
      }

      if (zoomOauthStatus === 'success') {
        setSuccess(t('settings.zoomConnectedSuccessfully'));
        setUserSettings((prev) => ({ ...prev, zoomConnected: true }));
        setError('');
      }

      if (zoomOauthStatus === 'error') {
        setError(t('settings.errors.connectZoom'));
        setSuccess('');
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('google_oauth');
      nextParams.delete('zoom_oauth');
      nextParams.delete('reason');
      setSearchParams(nextParams, { replace: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [googleOauthStatus, searchParams, setSearchParams, t, zoomOauthStatus]);

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

          const notificationDefaultsResponse = await apiClient.get<{ items: AccountNotificationDefault[] }>('/api/settings/account-notification-defaults', {
            headers: authHeaders(accessToken)
          });
          setAccountNotificationDefaults(notificationDefaultsResponse.data.items);
        }

        if (canManageSystemSettings) {
          const systemResponse = await apiClient.get<SystemSettings>('/api/settings/system', {
            headers: authHeaders(accessToken)
          });
          setSystemSettings(systemResponse.data);
        }

        if (canManageSpecialistBookingPolicy) {
          const specialistId = user?.role === 'specialist'
            ? null
            : await (async () => {
              const specialistsResponse = await apiClient.get<{
                specialists: Array<{ id: number }>;
              }>('/api/specialists', { headers: authHeaders(accessToken) });
              const first = specialistsResponse.data.specialists[0]?.id ?? null;
              setSelectedSpecialistId(first);
              return first;
            })();

          const policyResponse = await apiClient.get<SpecialistBookingPolicy>('/api/settings/specialist-booking-policy', {
            headers: authHeaders(accessToken),
            params: specialistId ? { specialistId } : undefined
          });
          setSpecialistBookingPolicy(policyResponse.data);
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
  }, [accessToken, canManageAccountSettings, canManageSpecialistBookingPolicy, canManageSystemSettings, navigate, t, user?.role]);

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

  const saveAccountNotificationDefaults = async (items: AccountNotificationDefault[]) => {
    if (!accessToken || !canManageAccountSettings) {
      return;
    }

    setIsSavingNotificationDefaults(true);
    try {
      const response = await apiClient.put<{ items: AccountNotificationDefault[] }>(
        '/api/settings/account-notification-defaults',
        { items },
        { headers: authHeaders(accessToken) }
      );
      setAccountNotificationDefaults(response.data.items);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingNotificationDefaults(false);
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

  const saveSpecialistBookingPolicy = async (nextPolicy: SpecialistBookingPolicy) => {
    if (!accessToken || !canManageSpecialistBookingPolicy) {
      return;
    }

    setIsSavingSpecialistPolicy(true);
    try {
      const params = user?.role === 'specialist'
        ? undefined
        : selectedSpecialistId
          ? { specialistId: selectedSpecialistId }
          : undefined;
      const response = await apiClient.put<SpecialistBookingPolicy>(
        '/api/settings/specialist-booking-policy',
        nextPolicy,
        { headers: authHeaders(accessToken), params }
      );
      setSpecialistBookingPolicy(response.data);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
    } finally {
      setIsSavingSpecialistPolicy(false);
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

  const connectZoom = async () => {
    if (!accessToken || isZoomConnecting) {
      return;
    }

    setIsZoomConnecting(true);

    try {
      const response = await apiClient.post<ZoomOAuthStartResponse>(
        '/api/integrations/zoom/oauth/start',
        {},
        { headers: authHeaders(accessToken) }
      );

      window.location.assign(response.data.authorizeUrl);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('settings.errors.connectZoom'),
        networkMessage: t('common.errors.network')
      }).message);
      setSuccess('');
      setIsZoomConnecting(false);
    }
  };


  const requestPasswordOtp = async () => {
    if (!accessToken || !currentPassword.trim() || newPassword.length < 10 || newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    try {
      await apiClient.post('/api/settings/user/password/request', { currentPassword, password: newPassword }, { headers: authHeaders(accessToken) });
      setPasswordStep('otp');
      setError('');
      setSuccess(t('settings.passwordChange.otpSent'));
    } catch (err) {
      setError(resolveApiError(err, { fallbackMessage: t('settings.errors.save'), networkMessage: t('common.errors.network') }).message);
    }
  };

  const confirmPasswordOtp = async () => {
    if (!accessToken) {
      return;
    }
    try {
      await apiClient.post('/api/settings/user/password/confirm', { password: newPassword, code: otpCode }, { headers: authHeaders(accessToken) });
      setSuccess(t('settings.passwordChange.success'));
      setError('');
      setPasswordStep('password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
    } catch (err) {
      setError(resolveApiError(err, { fallbackMessage: t('settings.errors.save'), networkMessage: t('common.errors.network') }).message);
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

  const cancelPasswordChange = () => {
    setPasswordStep('password');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setError('');
    setSuccess('');
  };

  return (
    <AppPage title={t('settings.pageTitle')} subtitle={t('settings.pageSubtitle')} maxWidth={800}>
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
            specialistBookingPolicy={specialistBookingPolicy}
            accountNotificationDefaults={accountNotificationDefaults}
            canManageSystemSettings={canManageSystemSettings}
            canManageAccountSettings={canManageAccountSettings}
            canManageSpecialistBookingPolicy={canManageSpecialistBookingPolicy}
            copy={{
              systemTab: t('settings.tabs.system'),
              accountTab: t('settings.tabs.account'),
              specialistPolicyTab: t('settings.tabs.specialistPolicy'),
              userTab: t('settings.tabs.user'),
              integrationsTab: t('settings.tabs.integrations'),
              passwordTab: t('settings.tabs.password'),
              systemTitle: t('settings.systemTitle'),
              accountTitle: t('settings.accountTitle'),
              userTitle: t('settings.userTitle'),
              passwordTitle: t('settings.passwordChange.title'),
              timezone: t('settings.timezone'),
              locale: t('settings.locale'),
              firstName: t('users.form.firstName'),
              lastName: t('users.form.lastName'),
              phone: t('users.form.phone'),
              telegram: t('users.form.telegram'),
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
              connectZoom: t('settings.connectZoom'),
              connectingZoom: t('settings.connectingZoom'),
              zoomConnected: t('settings.zoomConnected'),
              telegramBotToken: t('settings.telegramBotToken'),
              telegramBotConnected: t('settings.telegramBotConnected'),
              telegramBotNotConnected: t('settings.telegramBotNotConnected'),
              clearTelegramBotToken: t('settings.clearTelegramBotToken'),
              specialistPolicyTitle: t('settings.specialistPolicyTitle'),
              cancelGracePeriodHours: t('settings.cancelGracePeriodHours'),
              refundOnLateCancel: t('settings.refundOnLateCancel'),
              autoCancelUnpaidEnabled: t('settings.autoCancelUnpaidEnabled'),
              unpaidAutoCancelAfterHours: t('settings.unpaidAutoCancelAfterHours'),
              notificationsTab: t('settings.tabs.notifications'),
              notificationSettingsTitle: t('settings.notificationSettingsTitle'),
              reminderChannelsLabel: t('settings.reminderChannelsLabel'),
              appointmentReminderTimingsLabel: t('settings.appointmentReminderTimingsLabel'),
              paymentReminderTimingsLabel: t('settings.paymentReminderTimingsLabel'),
              disabledOption: t('settings.disabledOption'),
              currentPassword: t('settings.passwordChange.currentPassword'),
              newPassword: t('settings.passwordChange.newPassword'),
              confirmPassword: t('settings.passwordChange.confirmPassword'),
              otpCode: t('settings.passwordChange.otpLabel'),
              sendOtp: t('settings.passwordChange.submitPassword'),
              confirmOtp: t('settings.passwordChange.confirmOtp'),
              cancel: t('common.cancel'),
              channels: {
                email: t('settings.channels.email'),
                telegram: t('settings.channels.telegram'),
                viber: t('settings.channels.viber'),
                sms: t('settings.channels.sms'),
                whatsapp: t('settings.channels.whatsapp')
              }
            }}
            isGoogleConnecting={isGoogleConnecting}
            isGoogleDisconnecting={isGoogleDisconnecting}
            isZoomConnecting={isZoomConnecting}
            isSavingSystem={isSavingSystem}
            isSavingAccount={isSavingAccount}
            isSavingUser={isSavingUser}
            isSavingSpecialistBookingPolicy={isSavingSpecialistPolicy}
            isSavingNotificationDefaults={isSavingNotificationDefaults}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            otpCode={otpCode}
            passwordStep={passwordStep}
            onSaveSystem={saveSystemSettings}
            onSaveAccount={saveAccountSettings}
            onSaveUser={saveUserSettings}
            onSaveSpecialistBookingPolicy={saveSpecialistBookingPolicy}
            onSaveNotificationDefaults={saveAccountNotificationDefaults}
            onClearTelegramBotToken={clearTelegramBotToken}
            onConnectGoogle={connectGoogle}
            onConnectZoom={connectZoom}
            onDisconnectGoogle={disconnectGoogle}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onOtpCodeChange={setOtpCode}
            onCancelPasswordChange={cancelPasswordChange}
            onRequestPasswordOtp={requestPasswordOtp}
            onConfirmPasswordOtp={confirmPasswordOtp}
          />
        )}
      </Box>
    </AppPage>
  );
}
