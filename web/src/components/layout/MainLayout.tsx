import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { apiClient, authHeaders } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { useThemeSettings } from '../../shared/theme/ThemeContext';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { Header } from './Header';
import { LeftMenu } from './LeftMenu';

export function MainLayout() {
  const { mode, paletteVariantId, toggleMode, setPaletteVariantId } = useThemeSettings();
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, accessToken, user } = useAuth();
  const lastSyncedPreferencesRef = useRef('');

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      lastSyncedPreferencesRef.current = '';
      return;
    }

    const settingsLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
    const signature = `${settingsLocale}|${mode}|${paletteVariantId}`;
    if (signature === lastSyncedPreferencesRef.current) {
      return;
    }

    const sync = async () => {
      try {
        await apiClient.put('/api/settings/user', {
          locale: settingsLocale,
          uiThemeMode: mode,
          uiPaletteVariantId: paletteVariantId
        }, {
          headers: authHeaders(accessToken)
        });
        lastSyncedPreferencesRef.current = signature;
      } catch {
        // silent sync: profile settings will be saved in explicit settings screen as fallback
      }
    };

    void sync();
  }, [accessToken, isAuthenticated, locale, mode, paletteVariantId]);

  const menuItems = [
    { to: '/appointments', label: t('common.appointments'), icon: 'calendar' as const },
    ...(user?.role === 'owner' || user?.role === 'admin'
      ? [
        { to: '/specialists', label: t('common.specialists'), icon: 'specialists' as const },
      ]
      : []),
    ...(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'specialist'
      ? [{ to: '/users', label: t('common.users'), icon: 'users' as const }]
      : []),
    ...(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'specialist'
      ? [{ to: '/notification-logs', label: t('common.notificationLogs'), icon: 'notifications' as const }]
      : []),
    { to: '/settings', label: t('common.settings'), icon: 'settings' as const }
  ];

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Outlet />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header
        title={t('common.appTitle')}
        mode={mode}
        paletteVariantId={paletteVariantId}
        paletteSelectAriaLabel={t('common.appearancePaletteAria')}
        themeToggleAriaLabel={t('common.themeToggleAria')}
        languageSelectAriaLabel={t('common.languageAria')}
        localeLabel={t('common.language')}
        locale={locale}
        onToggleMode={toggleMode}
        onChangePalette={(id: PaletteVariantId) => setPaletteVariantId(id)}
        onChangeLocale={setLocale}
      />

      <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        <LeftMenu items={menuItems} />
        <Box component="main" sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
