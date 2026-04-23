import { CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../shared/auth/AuthContext';
import { I18nProvider } from '../shared/i18n/I18nContext';
import { ThemeSettingsContext } from '../shared/theme/ThemeContext';
import {
  DEFAULT_PALETTE_VARIANT_ID,
  type PaletteVariantId,
  type ThemeMode
} from '../shared/theme/constants';
import { createAppTheme } from '../shared/theme/createAppTheme';
import { router } from './router';
import { AppErrorBoundary } from './AppErrorBoundary';

function getInitialMode(): ThemeMode {
  const persisted = localStorage.getItem('ui-theme-mode');
  return persisted === 'dark' ? 'dark' : 'light';
}

function getInitialPalette(): PaletteVariantId {
  const persisted = localStorage.getItem('ui-theme-palette') as PaletteVariantId | null;
  return persisted ?? DEFAULT_PALETTE_VARIANT_ID;
}

export function App() {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());
  const [paletteVariantId, setPaletteVariantIdState] = useState<PaletteVariantId>(() => getInitialPalette());

  const theme = useMemo(() => createAppTheme(mode, paletteVariantId), [mode, paletteVariantId]);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('ui-theme-mode', next);
      return next;
    });
  };

  const setPaletteVariantId = (id: PaletteVariantId) => {
    setPaletteVariantIdState(id);
    localStorage.setItem('ui-theme-palette', id);
  };

  return (
    <AppErrorBoundary>
      <ThemeSettingsContext.Provider value={{ mode, paletteVariantId, toggleMode, setPaletteVariantId }}>
        <ThemeProvider theme={theme}>
          <I18nProvider>
            <AuthProvider>
              <CssBaseline />
              <RouterProvider router={router} />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </ThemeSettingsContext.Provider>
    </AppErrorBoundary>
  );
}
