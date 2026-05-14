import { createTheme } from '@mui/material';
import {
  APP_SHADOWS,
  APP_SIZING,
  DEFAULT_PALETTE_VARIANT_ID,
  PALETTE_VARIANTS,
  rem,
  type PaletteVariantId,
  type ThemeMode
} from './constants';

export function createAppTheme(mode: ThemeMode, paletteVariantId: PaletteVariantId = DEFAULT_PALETTE_VARIANT_ID) {
  const selectedVariant =
    PALETTE_VARIANTS.find((variant) => variant.id === paletteVariantId) ?? PALETTE_VARIANTS[0];

  const palette = mode === 'light' ? selectedVariant.light : selectedVariant.dark;
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: { main: palette.primary },
      secondary: { main: palette.secondary },
      success: {
        main: isLight ? 'hsl(154, 61%, 36%)' : 'hsl(154, 60%, 54%)'
      },
      warning: {
        main: isLight ? 'hsl(28, 88%, 46%)' : 'hsl(35, 92%, 62%)'
      },
      error: {
        main: isLight ? 'hsl(0, 76%, 52%)' : 'hsl(0, 86%, 68%)'
      },
      info: {
        main: isLight ? 'hsl(206, 100%, 42%)' : 'hsl(206, 100%, 68%)'
      },
      divider: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(148, 163, 184, 0.18)',
      text: {
        primary: isLight ? 'hsl(222, 47%, 11%)' : 'hsl(210, 40%, 96%)',
        secondary: isLight ? 'hsl(215, 16%, 40%)' : 'hsl(215, 20%, 72%)'
      },
      action: {
        hover: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(148, 163, 184, 0.08)',
        selected: isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(148, 163, 184, 0.14)',
        disabledBackground: isLight ? 'rgba(148, 163, 184, 0.18)' : 'rgba(71, 85, 105, 0.38)'
      },
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
      h3: { fontWeight: 700, fontSize: '2rem' },
      h4: { fontWeight: 700, fontSize: '1.75rem' },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
      body2: {
        lineHeight: 1.5
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            minWidth: 320
          },
          '*': {
            boxSizing: 'border-box'
          },
          '::selection': {
            backgroundColor: isLight ? 'rgba(59, 130, 246, 0.18)' : 'rgba(96, 165, 250, 0.28)'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusLg,
            backgroundImage: 'none'
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusLg,
            boxShadow: isLight ? APP_SHADOWS.softLight : APP_SHADOWS.softDark
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
            minHeight: rem(42),
            paddingInline: rem(16),
            transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
            '&:focus-visible': {
              outline: `${rem(3)} solid ${isLight ? 'rgba(37, 99, 235, 0.24)' : 'rgba(96, 165, 250, 0.28)'}`,
              outlineOffset: 2
            }
          },
          contained: {
            boxShadow: isLight ? APP_SHADOWS.softLight : 'none',
            '&:hover': {
              boxShadow: isLight ? APP_SHADOWS.surfaceLight : APP_SHADOWS.softDark,
              transform: `translateY(-${rem(1)})`
            }
          },
          outlined: {
            borderWidth: 1,
            '&:hover': {
              borderWidth: 1
            }
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusSm
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusMd,
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(15, 23, 42, 0.36)',
            transition: 'border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isLight ? 'rgba(15, 23, 42, 0.24)' : 'rgba(148, 163, 184, 0.28)'
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 ${rem(4)} ${isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(96, 165, 250, 0.16)'}`
            }
          },
          input: {
            paddingTop: 13,
            paddingBottom: 13
          },
          notchedOutline: {
            borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.18)'
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginLeft: 0,
            marginRight: 0
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusMd
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: APP_SIZING.radiusXl,
            boxShadow: isLight ? APP_SHADOWS.surfaceLight : APP_SHADOWS.surfaceDark
          }
        }
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: `${rem(24)} ${rem(24)} ${rem(8)}`
          }
        }
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: `${rem(16)} ${rem(24)}`
          }
        }
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: `${rem(16)} ${rem(24)} ${rem(24)}`
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
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: APP_SIZING.radiusSm,
            minWidth: 0
          }
        }
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.surfaceRadius
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            color: isLight ? 'hsl(215, 20%, 32%)' : 'hsl(215, 20%, 76%)',
            backgroundColor: isLight ? 'rgba(148, 163, 184, 0.08)' : 'rgba(30, 41, 59, 0.55)'
          },
          root: {
            borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.12)'
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 140ms ease'
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: APP_SIZING.radiusMd
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999
          }
        }
      }
    }
  });
}
