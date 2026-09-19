import { Box, CircularProgress, CssBaseline, ThemeProvider, Typography } from '@mui/material';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../shared/auth/AuthContext';
import { I18nProvider, useI18n } from '../shared/i18n/I18nContext';
import { ThemeSettingsContext } from '../shared/theme/ThemeContext';
import { type ThemeMode } from '../shared/theme/constants';
import { createAppTheme } from '../shared/theme/createAppTheme';
import { router } from './router';
import { AppErrorBoundary } from './AppErrorBoundary';
import { ThemeModeSync } from './ThemeModeSync';
import { WebErrorTracker } from './WebErrorTracker';

function RouteLoadingFallback() {
  const { t } = useI18n();

  return (
    <Box role="status" aria-live="polite" className="app-route-loading">
      <CircularProgress size={32} aria-hidden />
      <Typography color="text.secondary">{t('common.loading')}</Typography>
    </Box>
  );
}

function getInitialMode(): ThemeMode {
  const persisted = localStorage.getItem('ui-theme-mode');
  return persisted === 'dark' ? 'dark' : 'light';
}

export function App() {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    localStorage.setItem('ui-theme-palette', 'default');
  }, []);

  const applyMode = (next: ThemeMode) => {
    localStorage.setItem('ui-theme-mode', next);
    setMode(next);
  };

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('ui-theme-mode', next);
      return next;
    });
  };

  return (
    <AppErrorBoundary>
      <ThemeSettingsContext.Provider value={{ mode, toggleMode, setMode: applyMode }}>
        <ThemeProvider theme={theme}>
          <I18nProvider>
            <AppErrorBoundary>
              <AuthProvider>
                <WebErrorTracker />
                <ThemeModeSync />
                <CssBaseline />
                <Suspense fallback={<RouteLoadingFallback />}>
                  <RouterProvider router={router} />
                </Suspense>
              </AuthProvider>
            </AppErrorBoundary>
          </I18nProvider>
        </ThemeProvider>
      </ThemeSettingsContext.Provider>
    </AppErrorBoundary>
  );
}
