import { useEffect, useRef } from 'react';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useThemeSettings } from '../shared/theme/ThemeContext';
import type { ThemeMode } from '../shared/theme/constants';

type UserSettingsResponse = { uiThemeMode?: ThemeMode };

// Keeps the theme mode toggle in sync with the user's profile (web_users.ui_theme_mode)
// so it follows them across devices/browsers instead of only living in localStorage.
export function ThemeModeSync() {
  const { accessToken } = useAuth();
  const { mode, setMode } = useThemeSettings();
  const lastKnownServerMode = useRef<ThemeMode | null>(null);
  const hasSyncedDown = useRef(false);

  // Pull the server's value once per session and let it win over whatever was in
  // localStorage — must finish before the push effect below is allowed to run,
  // otherwise a stale local value could overwrite the server on every page load.
  useEffect(() => {
    hasSyncedDown.current = false;
    lastKnownServerMode.current = null;

    if (!accessToken) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<UserSettingsResponse>('/api/settings/user', { headers: authHeaders(accessToken) })
      .then((response) => {
        if (cancelled) return;
        const serverMode = response.data.uiThemeMode;
        if (serverMode === 'light' || serverMode === 'dark') {
          lastKnownServerMode.current = serverMode;
          setMode(serverMode);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) hasSyncedDown.current = true;
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Push a user-driven toggle to the server, once we know it's not just the
  // sync-down above applying the server's own value back onto itself.
  useEffect(() => {
    if (!accessToken || !hasSyncedDown.current || lastKnownServerMode.current === mode) {
      return;
    }

    lastKnownServerMode.current = mode;
    void apiClient
      .put('/api/settings/user', { uiThemeMode: mode }, { headers: authHeaders(accessToken) })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, mode]);

  return null;
}
