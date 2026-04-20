import { Alert, Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsCard } from '../components/SettingsCard';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type { AppSettings } from '../shared/types/api';

const defaultSettings: AppSettings = {
  timezone: 'UTC',
  dailyDigestEnabled: true,
  defaultMeetingDuration: 30,
  weekStartsOnMonday: true,
  locale: 'ru-RU',
  googleConnected: false
};

export function SettingsContainer() {
  const navigate = useNavigate();
  const { accessToken, clearAuth } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [error, setError] = useState('');

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

  const saveSettings = async () => {
    try {
      const response = await apiClient.put<AppSettings>('/api/settings', settings, {
        headers: authHeaders(accessToken)
      });
      setSettings(response.data);
      setError('');
    } catch {
      setError(t('settings.errors.save'));
    }
  };

  const connectGoogle = async () => {
    try {
      await apiClient.post('/api/integrations/google/connect', {}, { headers: authHeaders(accessToken) });
      setSettings((prev) => ({ ...prev, googleConnected: true }));
      setError('');
    } catch {
      setError(t('settings.errors.connectGoogle'));
    }
  };

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <AppPage title={t('settings.pageTitle')} subtitle={t('settings.pageSubtitle')}>
      {error && (
        <Box sx={{ maxWidth: 720, mb: 2 }}>
          <Alert severity="error">{error}</Alert>
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
            googleConnected: t('settings.googleConnected'),
            logout: t('common.logout')
          }}
          onSettingsChange={setSettings}
          onSave={saveSettings}
          onConnectGoogle={connectGoogle}
          onLogout={logout}
        />
      </Box>
    </AppPage>
  );
}
