import { createTheme } from '@mui/material';
import {
  APP_TOKENS,
  type ThemeMode,
} from './constants';

const tokenVariables = {
  '--app-space-xs': APP_TOKENS.space.xs,
  '--app-space-s': APP_TOKENS.space.s,
  '--app-space-m': APP_TOKENS.space.m,
  '--app-space-l': APP_TOKENS.space.l,
  '--app-space-xl': APP_TOKENS.space.xl,
  '--app-font-xs': APP_TOKENS.fontSize.xs,
  '--app-font-s': APP_TOKENS.fontSize.s,
  '--app-font-m': APP_TOKENS.fontSize.m,
  '--app-font-l': APP_TOKENS.fontSize.l,
  '--app-font-xl': APP_TOKENS.fontSize.xl,
  '--app-radius-xs': APP_TOKENS.radius.xs,
  '--app-radius-s': APP_TOKENS.radius.s,
  '--app-radius-m': APP_TOKENS.radius.m,
  '--app-radius-l': APP_TOKENS.radius.l,
  '--app-radius-xl': APP_TOKENS.radius.xl,
  '--app-radius-pill': APP_TOKENS.radius.pill,
  '--app-radius-circle': APP_TOKENS.radius.circle,
  '--app-weight-regular': APP_TOKENS.fontWeight.regular,
  '--app-weight-medium': APP_TOKENS.fontWeight.medium,
  '--app-weight-semibold': APP_TOKENS.fontWeight.semibold,
  '--app-weight-bold': APP_TOKENS.fontWeight.bold,
  '--app-line-compact': APP_TOKENS.lineHeight.compact,
  '--app-line-default': APP_TOKENS.lineHeight.default,
  '--app-line-relaxed': APP_TOKENS.lineHeight.relaxed,
  '--app-control-s': APP_TOKENS.controlHeight.s,
  '--app-control-m': APP_TOKENS.controlHeight.m,
  '--app-control-l': APP_TOKENS.controlHeight.l,
  '--app-motion-fast': APP_TOKENS.motion.fast,
  '--app-motion-default': APP_TOKENS.motion.default,
  '--app-motion-slow': APP_TOKENS.motion.slow,
  '--app-easing': APP_TOKENS.motion.easing,
  '--app-sidebar-width': APP_TOKENS.layout.sidebar,
  '--app-page-max': APP_TOKENS.layout.pageMax,
  '--app-page-narrow': APP_TOKENS.layout.pageNarrow,
  '--app-dialog-s': APP_TOKENS.layout.dialogS,
  '--app-dialog-m': APP_TOKENS.layout.dialogM,
  '--app-dialog-l': APP_TOKENS.layout.dialogL,
  '--app-header-height': APP_TOKENS.layout.header,
  '--app-border-width': APP_TOKENS.border.width,
  '--app-z-header': APP_TOKENS.zIndex.header,
  '--app-z-drawer': APP_TOKENS.zIndex.drawer,
  '--app-z-modal': APP_TOKENS.zIndex.modal,
  '--app-z-tooltip': APP_TOKENS.zIndex.tooltip,
} as const;

export function createAppTheme(mode: ThemeMode) {
  const colors = APP_TOKENS.colors[mode];
  const isLight = mode === 'light';
  const shadows = isLight
    ? { soft: APP_TOKENS.shadow.softLight, surface: APP_TOKENS.shadow.surfaceLight }
    : { soft: APP_TOKENS.shadow.softDark, surface: APP_TOKENS.shadow.surfaceDark };

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryActive,
        light: colors.primaryHover,
        contrastText: colors.onPrimary,
      },
      secondary: { main: colors.accent },
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.danger },
      info: { main: colors.info },
      divider: colors.border,
      text: { primary: colors.text, secondary: colors.textMuted, disabled: colors.disabled },
      action: {
        hover: colors.actionHover,
        selected: colors.actionSelected,
        disabled: colors.disabled,
        disabledBackground: colors.surfaceMuted,
      },
      background: { default: colors.canvas, paper: colors.surface },
    },
    // Numeric sx radii still exist outside the migrated dashboard UI. Preserve their established rendering.
    shape: { borderRadius: APP_TOKENS.legacy.muiRadiusMultiplier },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      fontSize: 16,
      h3: { fontWeight: APP_TOKENS.fontWeight.bold, fontSize: APP_TOKENS.fontSize.xl },
      h4: { fontWeight: APP_TOKENS.fontWeight.bold, fontSize: APP_TOKENS.fontSize.xl },
      h5: { fontWeight: APP_TOKENS.fontWeight.bold, fontSize: APP_TOKENS.fontSize.l },
      h6: { fontWeight: APP_TOKENS.fontWeight.bold, fontSize: APP_TOKENS.fontSize.l },
      subtitle1: { fontWeight: APP_TOKENS.fontWeight.semibold },
      subtitle2: { fontWeight: APP_TOKENS.fontWeight.semibold },
      button: { textTransform: 'none', fontWeight: APP_TOKENS.fontWeight.semibold },
      body1: { fontSize: APP_TOKENS.fontSize.m, lineHeight: APP_TOKENS.lineHeight.default },
      body2: { fontSize: APP_TOKENS.fontSize.s, lineHeight: APP_TOKENS.lineHeight.default },
      caption: { fontSize: APP_TOKENS.fontSize.xs },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            ...tokenVariables,
            '--app-color-primary': colors.primary,
            '--app-color-primary-hover': colors.primaryHover,
            '--app-color-primary-active': colors.primaryActive,
            '--app-color-primary-soft': colors.primarySoft,
            '--app-color-accent': colors.accent,
            '--app-color-on-primary': colors.onPrimary,
            '--app-color-canvas': colors.canvas,
            '--app-color-surface': colors.surface,
            '--app-color-surface-muted': colors.surfaceMuted,
            '--app-color-text': colors.text,
            '--app-color-text-muted': colors.textMuted,
            '--app-color-disabled': colors.disabled,
            '--app-color-border': colors.border,
            '--app-color-border-strong': colors.borderStrong,
            '--app-color-success': colors.success,
            '--app-color-success-soft': colors.successSoft,
            '--app-color-warning': colors.warning,
            '--app-color-warning-soft': colors.warningSoft,
            '--app-color-danger': colors.danger,
            '--app-color-danger-soft': colors.dangerSoft,
            '--app-color-info': colors.info,
            '--app-color-info-soft': colors.infoSoft,
            '--app-color-action-hover': colors.actionHover,
            '--app-color-action-selected': colors.actionSelected,
            '--app-color-focus-ring': colors.focusRing,
            '--app-color-overlay': colors.overlay,
            '--app-shadow-soft': shadows.soft,
            '--app-shadow-surface': shadows.surface,
          },
          html: { colorScheme: mode },
          body: {
            minWidth: 320,
            backgroundColor: 'var(--app-color-canvas)',
            color: 'var(--app-color-text)',
          },
          '*': { boxSizing: 'border-box' },
          '::selection': { backgroundColor: colors.actionSelected },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 'var(--app-radius-m)', backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 'var(--app-radius-m)', boxShadow: 'var(--app-shadow-soft)' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 'var(--app-radius-s)',
            minHeight: 'var(--app-control-m)',
            paddingInline: 'var(--app-space-m)',
            transition: 'background-color var(--app-motion-default) var(--app-easing), border-color var(--app-motion-default) var(--app-easing), color var(--app-motion-default) var(--app-easing), box-shadow var(--app-motion-default) var(--app-easing), transform var(--app-motion-default) var(--app-easing)',
            '&:focus-visible': {
              outline: 'var(--app-radius-xs) solid var(--app-color-focus-ring)',
              outlineOffset: 'var(--app-space-xs)',
            },
          },
          contained: {
            boxShadow: 'var(--app-shadow-soft)',
            '&:hover': {
              boxShadow: 'var(--app-shadow-surface)',
              transform: 'translateY(calc(var(--app-border-width) * -1))',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-s)' } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 'var(--app-radius-s)',
            backgroundColor: 'var(--app-color-surface)',
            transition: 'border-color var(--app-motion-default) var(--app-easing), box-shadow var(--app-motion-default) var(--app-easing), background-color var(--app-motion-default) var(--app-easing)',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--app-color-border-strong)' },
            '&.Mui-focused': { boxShadow: '0 0 0 var(--app-radius-xs) var(--app-color-focus-ring)' },
          },
          input: { paddingTop: 'var(--app-space-s)', paddingBottom: 'var(--app-space-s)' },
          notchedOutline: { borderColor: 'var(--app-color-border)' },
        },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginLeft: 0, marginRight: 0 } },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-s)' } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 'var(--app-radius-m)', boxShadow: 'var(--app-shadow-surface)' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { padding: 'var(--app-space-l) var(--app-space-l) var(--app-space-s)' } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: 'var(--app-space-m) var(--app-space-l)' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: 'var(--app-space-m) var(--app-space-l) var(--app-space-l)' } },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 'var(--app-control-m)' },
          indicator: { height: 'var(--app-radius-xs)', borderRadius: 'var(--app-radius-pill)' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { minHeight: 'var(--app-control-m)', borderRadius: 'var(--app-radius-s)', minWidth: 0 },
        },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-m)' } },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: APP_TOKENS.fontWeight.semibold,
            color: 'var(--app-color-text-muted)',
            backgroundColor: 'var(--app-color-surface-muted)',
          },
          root: { borderColor: 'var(--app-color-border)' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { transition: 'background-color var(--app-motion-fast) var(--app-easing)' },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-s)' } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-pill)' } },
      },
    },
  });
}
