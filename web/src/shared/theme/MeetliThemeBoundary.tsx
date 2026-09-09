import { ThemeProvider } from '@mui/material';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { createMeetliAppTheme } from './createAppTheme';
import { useThemeSettings } from './ThemeContext';

export function MeetliThemeBoundary() {
  const { mode } = useThemeSettings();
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const theme = useMemo(
    () => createMeetliAppTheme(mode, portalContainer),
    [mode, portalContainer],
  );

  return (
    <ThemeProvider theme={theme}>
      <div ref={setPortalContainer} className="meetli-design-system">
        <Outlet />
      </div>
    </ThemeProvider>
  );
}
