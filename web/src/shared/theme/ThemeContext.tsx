import { createContext, useContext } from 'react';
import type { PaletteVariantId, ThemeMode } from './constants';

type ThemeSettingsContextValue = {
  mode: ThemeMode;
  paletteVariantId: PaletteVariantId;
  toggleMode: () => void;
  setPaletteVariantId: (id: PaletteVariantId) => void;
};

export const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

export function useThemeSettings() {
  const context = useContext(ThemeSettingsContext);

  if (!context) {
    throw new Error('useThemeSettings must be used inside ThemeSettingsContext.Provider');
  }

  return context;
}
