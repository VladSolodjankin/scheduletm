import { createTheme } from '@mui/material';
import {
  APP_SIZING,
  DEFAULT_PALETTE_VARIANT_ID,
  PALETTE_VARIANTS,
  type PaletteVariantId,
  type ThemeMode
} from './constants';

export function createAppTheme(mode: ThemeMode, paletteVariantId: PaletteVariantId = DEFAULT_PALETTE_VARIANT_ID) {
  const selectedVariant =
    PALETTE_VARIANTS.find((variant) => variant.id === paletteVariantId) ?? PALETTE_VARIANTS[0];

  const palette = mode === 'light' ? selectedVariant.light : selectedVariant.dark;

  return createTheme({
    palette: {
      mode,
      primary: { main: palette.primary },
      secondary: { main: palette.secondary },
      background: {
        default: palette.backgroundDefault,
        paper: palette.backgroundPaper
      }
    },
    shape: {
      borderRadius: APP_SIZING.radiusMd
    },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 }
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusLg
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusMd,
            minHeight: 40,
            paddingInline: 16
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusMd
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 44
          },
          indicator: {
            height: 3,
            borderRadius: 999
          }
        }
      }
    }
  });
}
