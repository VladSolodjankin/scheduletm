import { createContext, useContext } from 'react';
import type { ThemeMode } from './constants';

type ThemeSettingsContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

export function useThemeSettings() {
  const context = useContext(ThemeSettingsContext);

  if (!context) {
    throw new Error('useThemeSettings must be used inside ThemeSettingsContext.Provider');
  }

  return context;
}
