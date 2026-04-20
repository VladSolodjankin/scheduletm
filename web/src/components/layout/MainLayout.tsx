import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useI18n } from '../../shared/i18n/I18nContext';
import { useThemeSettings } from '../../shared/theme/ThemeContext';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { Header } from './Header';
import { LeftMenu } from './LeftMenu';

export function MainLayout() {
  const { mode, paletteVariantId, toggleMode, setPaletteVariantId } = useThemeSettings();
  const { t, locale, setLocale } = useI18n();

  const menuItems = [
    { to: '/login', label: t('common.login'), icon: 'login' as const },
    { to: '/register', label: t('common.register'), icon: 'register' as const },
    { to: '/settings', label: t('common.settings'), icon: 'settings' as const }
  ];

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
