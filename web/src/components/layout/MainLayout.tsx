import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useThemeSettings } from '../../shared/theme/ThemeContext';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { Header } from './Header';
import { LeftMenu } from './LeftMenu';

const menuItems = [
  { to: '/login', label: 'Вход', icon: 'login' as const },
  { to: '/register', label: 'Регистрация', icon: 'register' as const },
  { to: '/settings', label: 'Настройки', icon: 'settings' as const }
];

export function MainLayout() {
  const { mode, paletteVariantId, toggleMode, setPaletteVariantId } = useThemeSettings();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header
        title="ScheduleTM"
        mode={mode}
        paletteVariantId={paletteVariantId}
        onToggleMode={toggleMode}
        onChangePalette={(id: PaletteVariantId) => setPaletteVariantId(id)}
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
