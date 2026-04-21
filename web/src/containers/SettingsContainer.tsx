import { Alert, Box } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SettingsCard } from '../components/SettingsCard';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type { AppSettings, GoogleOAuthStartResponse } from '../shared/types/api';

const defaultSettings: AppSettings = {
  timezone: 'UTC',
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  locale: 'ru-RU',
  googleConnected: false,
  uiThemeMode: 'light',
  uiPaletteVariantId: 'default'
};

export function SettingsContainer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const googleOauthStatus = useMemo(() => searchParams.get('google_oauth'), [searchParams]);

  useEffect(() => {
    if (!googleOauthStatus) {
      return;
    }

    if (googleOauthStatus === 'success') {
      setSuccess(t('settings.googleConnectedSuccessfully'));
      setSettings((prev) => ({ ...prev, googleConnected: true }));
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
      try {
        const response = await apiClient.get<AppSettings>('/api/settings', {
          headers: authHeaders(accessToken)
        });
        setSettings(response.data);
      } catch {
        setError(t('settings.errors.load'));
      }
    };

    void load();
  }, [accessToken, navigate, t]);

  const saveSettings = async (nextSettings: AppSettings) => {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await apiClient.put<AppSettings>('/api/settings', nextSettings, {
        headers: authHeaders(accessToken)
      });
      setSettings(response.data);
      setError('');
      setSuccess('');
    } catch {
      setError(t('settings.errors.save'));
      setSuccess('');
    } finally {
      setIsSaving(false);
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
        <SettingsCard
          settings={settings}
          copy={{
            generalTab: t('settings.tabs.general'),
            integrationsTab: t('settings.tabs.integrations'),
            profileTitle: t('settings.profileTitle'),
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
            googleConnected: t('settings.googleConnected')
          }}
          isGoogleConnecting={isGoogleConnecting}
          isSaving={isSaving}
          onSave={saveSettings}
          onConnectGoogle={connectGoogle}
        />
      </Box>
    </AppPage>
  );
}
