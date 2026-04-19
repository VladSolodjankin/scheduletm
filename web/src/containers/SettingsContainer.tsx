import { Alert, Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsCard } from '../components/SettingsCard';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
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
        setError('Не удалось загрузить настройки.');
      }
    };

    void load();
  }, [accessToken, navigate]);

  const saveSettings = async () => {
    try {
      const response = await apiClient.put<AppSettings>('/api/settings', settings, {
        headers: authHeaders(accessToken)
      });
      setSettings(response.data);
      setError('');
    } catch {
      setError('Не удалось сохранить настройки.');
    }
  };

  const connectGoogle = async () => {
    try {
      await apiClient.post('/api/integrations/google/connect', {}, { headers: authHeaders(accessToken) });
      setSettings((prev) => ({ ...prev, googleConnected: true }));
      setError('');
    } catch {
      setError('Не удалось подключить Google.');
    }
  };

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Box>
      {error && (
        <Box sx={{ maxWidth: 560, mx: 'auto', mt: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
      <SettingsCard
        settings={settings}
        onSettingsChange={setSettings}
        onSave={saveSettings}
        onConnectGoogle={connectGoogle}
        onLogout={logout}
      />
    </Box>
  );
}
