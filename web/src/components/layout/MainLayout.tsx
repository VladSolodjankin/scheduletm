import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { apiClient, authHeaders } from '../../shared/api/client';
import { WebUserRole } from '../../shared/types/roles';
import { useAuth } from '../../shared/auth/AuthContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { useThemeSettings } from '../../shared/theme/ThemeContext';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { Header } from './Header';
import { LeftMenu } from './LeftMenu';
import { LegalFooter } from '../legal/LegalFooter';

export function MainLayout() {
  const theme = useTheme();
  const isCompactNavigation = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, paletteVariantId, toggleMode, setPaletteVariantId } = useThemeSettings();
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, accessToken, user } = useAuth();
  const lastSyncedPreferencesRef = useRef('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const appointmentsMenuLabel = (() => {
    if (user?.role === WebUserRole.Owner) {
      return t('appointments.pageSubtitleOwner');
    }
    if (user?.role === WebUserRole.Admin) {
      return t('appointments.pageSubtitleAdmin');
    }
    if (user?.role === WebUserRole.Specialist) {
      return t('appointments.pageSubtitleSpecialist');
    }
    if (user?.role === WebUserRole.Client) {
      return t('appointments.pageSubtitleClient');
    }
    return t('common.appointments');
  })();

  const menuItems = [
    { to: '/appointments', label: appointmentsMenuLabel, icon: 'calendar' as const },
    ...(user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin
      ? [
        { to: '/specialists', label: t('common.specialists'), icon: 'specialists' as const },
      ]
      : []),
    ...(user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin || user?.role === WebUserRole.Specialist
      ? [{ to: '/users', label: t('common.users'), icon: 'users' as const }]
      : []),
    ...(user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin || user?.role === WebUserRole.Specialist
      ? [{ to: '/notification-logs', label: t('common.notificationLogs'), icon: 'notifications' as const }]
      : []),
    ...(user?.role === WebUserRole.Owner
      ? [{ to: '/error-logs', label: t('common.errorLogs'), icon: 'errors' as const }]
      : []),
    { to: '/settings', label: t('common.settings'), icon: 'settings' as const }
  ];

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
        <LegalFooter />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden'
      }}
    >
      <Header
        title={t('common.appTitle')}
        mode={mode}
        paletteVariantId={paletteVariantId}
        paletteSelectAriaLabel={t('common.appearancePaletteAria')}
        themeToggleAriaLabel={t('common.themeToggleAria')}
        languageSelectAriaLabel={t('common.languageAria')}
        localeLabel={t('common.language')}
        locale={locale}
        showMobileMenuButton={isCompactNavigation}
        onToggleMode={toggleMode}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onChangePalette={(id: PaletteVariantId) => setPaletteVariantId(id)}
        onChangeLocale={setLocale}
      />

      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          minHeight: 0
        }}
      >
        <LeftMenu items={menuItems} headingLabel={t('common.workspace')} />
        <Drawer
          anchor="left"
          open={isCompactNavigation && isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: 'min(88vw, 18rem)',
                bgcolor: 'background.paper',
                borderRadius: 0,
              }
            }
          }}
        >
          <LeftMenu
            items={menuItems}
            headingLabel={t('common.workspace')}
            mobile
            onClose={() => setIsMobileMenuOpen(false)}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
        </Drawer>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto'
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <LegalFooter />
    </Box>
  );
}
