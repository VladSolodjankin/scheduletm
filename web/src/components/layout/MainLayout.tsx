import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { apiClient, authHeaders } from '../../shared/api/client';
import { WebUserRole } from '../../shared/types/roles';
import { useAuth } from '../../shared/auth/AuthContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { useThemeSettings } from '../../shared/theme/ThemeContext';
import { DEFAULT_PALETTE_VARIANT_ID } from '../../shared/theme/constants';
import { Header } from './Header';
import { LeftMenu } from './LeftMenu';
import { LegalFooter } from '../legal/LegalFooter';

export function MainLayout() {
  const theme = useTheme();
  const isCompactNavigation = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, toggleMode } = useThemeSettings();
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
    const signature = `${settingsLocale}|${mode}|${DEFAULT_PALETTE_VARIANT_ID}`;
    if (signature === lastSyncedPreferencesRef.current) {
      return;
    }

    const sync = async () => {
      try {
        await apiClient.put('/api/settings/user', {
          locale: settingsLocale,
          uiThemeMode: mode,
          uiPaletteVariantId: DEFAULT_PALETTE_VARIANT_ID
        }, {
          headers: authHeaders(accessToken)
        });
        lastSyncedPreferencesRef.current = signature;
      } catch {
        // silent sync: profile settings will be saved in explicit settings screen as fallback
      }
    };

    void sync();
  }, [accessToken, isAuthenticated, locale, mode]);

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
    ...(user?.role === WebUserRole.ProductOwner || user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin
      ? [
        { to: '/specialists', label: t('common.specialists'), icon: 'specialists' as const },
        { to: '/public-pages', label: t('publicPageBuilder.pages'), icon: 'publicPages' as const },
      ]
      : []),
    ...(user?.role === WebUserRole.ProductOwner || user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin || user?.role === WebUserRole.Specialist
      ? [{ to: '/services', label: t('common.services'), icon: 'calendar' as const }]
      : []),
    ...(user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin || user?.role === WebUserRole.Specialist
      ? [{ to: '/users', label: t('common.users'), icon: 'users' as const }]
      : []),
    ...(user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin || user?.role === WebUserRole.Specialist
      ? [{ to: '/notification-logs', label: t('common.notificationLogs'), icon: 'notifications' as const }]
      : []),
    ...(user?.role === WebUserRole.ProductOwner
      ? [{ to: '/error-logs', label: t('common.errorLogs'), icon: 'errors' as const }]
      : []),
    { to: '/settings', label: t('common.settings'), icon: 'settings' as const }
  ];

  if (!isAuthenticated) {
    return (
      <Box className="app-layout">
        <Box className="app-layout__content">
          <Outlet />
        </Box>
        <LegalFooter />
      </Box>
    );
  }

  return (
    <Box className="app-layout app-layout--authenticated">
      {isCompactNavigation ? (
        <Header
          title={t('common.appTitle')}
          mode={mode}
          themeToggleAriaLabel={t('common.themeToggleAria')}
          languageSelectAriaLabel={t('common.languageAria')}
          localeLabel={t('common.language')}
          locale={locale}
          showMobileMenuButton
          onToggleMode={toggleMode}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onChangeLocale={setLocale}
        />
      ) : null}

      <Box className="app-layout__main-row">
        <LeftMenu
          items={menuItems}
          headingLabel={t('common.workspace')}
          title={t('common.appTitle')}
          mode={mode}
          locale={locale}
          themeToggleAriaLabel={t('common.themeToggleAria')}
          languageSelectAriaLabel={t('common.languageAria')}
          onToggleMode={toggleMode}
          onChangeLocale={setLocale}
        />
        <Drawer
          anchor="left"
          open={isCompactNavigation && isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          slotProps={{
            paper: {
              className: 'app-layout__drawer-paper'
            }
          }}
        >
          <LeftMenu
            items={menuItems}
            headingLabel={t('common.workspace')}
            title={t('common.appTitle')}
            mode={mode}
            locale={locale}
            themeToggleAriaLabel={t('common.themeToggleAria')}
            languageSelectAriaLabel={t('common.languageAria')}
            mobile
            onClose={() => setIsMobileMenuOpen(false)}
            onNavigate={() => setIsMobileMenuOpen(false)}
            onToggleMode={toggleMode}
            onChangeLocale={setLocale}
          />
        </Drawer>
        <Box component="main" className="app-layout__main">
          <Outlet />
        </Box>
      </Box>

      <LegalFooter />
    </Box>
  );
}
