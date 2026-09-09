import { createTheme } from '@mui/material';
import {
  APP_TOKENS,
  type ThemeMode,
} from './constants';

const tokenVariables = {
  '--app-font-family': APP_TOKENS.fontFamily,
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
  '--app-control-m': APP_TOKENS.publicPageBase.controlHeightM,
  '--app-control-l': APP_TOKENS.controlHeight.l,
  '--app-icon-xs': APP_TOKENS.iconSize.xs,
  '--app-icon-s': APP_TOKENS.iconSize.s,
  '--app-icon-m': APP_TOKENS.iconSize.m,
  '--app-icon-l': APP_TOKENS.iconSize.l,
  '--app-icon-xl': APP_TOKENS.iconSize.xl,
  '--app-avatar-xs': APP_TOKENS.avatarSize.xs,
  '--app-avatar-s': APP_TOKENS.avatarSize.s,
  '--app-avatar-m': APP_TOKENS.avatarSize.m,
  '--app-avatar-l': APP_TOKENS.avatarSize.l,
  '--app-avatar-xl': APP_TOKENS.avatarSize.xl,
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
    // The root profile supplies stable metrics for rendered Public Page content.
    shape: { borderRadius: APP_TOKENS.publicPageBase.muiRadiusMultiplier },
    typography: {
      fontFamily: APP_TOKENS.fontFamily,
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

/**
 * Route-scoped Meetli profile for the application shell and management screens.
 */
export function createMeetliAppTheme(mode: ThemeMode, portalContainer?: HTMLElement | null) {
  const baseTheme = createAppTheme(mode);
  const colors = APP_TOKENS.colors[mode];
  const typography = APP_TOKENS.typography;
  const container = portalContainer ?? undefined;

  return createTheme(baseTheme, {
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: APP_TOKENS.fontFamily,
      h3: typography.headingXl,
      h4: typography.headingXl,
      h5: typography.headingL,
      h6: typography.headingM,
      subtitle1: typography.headingM,
      subtitle2: typography.labelS,
      body1: typography.bodyM,
      body2: typography.bodyS,
      caption: typography.captionXs,
      button: { ...typography.buttonS, textTransform: 'none' },
    },
    components: {
      MuiModal: { defaultProps: { container } },
      MuiPopover: { defaultProps: { container } },
      MuiPopper: { defaultProps: { container } },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 'var(--app-radius-s)', backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: 'var(--app-border-width) solid var(--app-color-border)',
            borderRadius: 'var(--app-radius-s)',
            boxShadow: 'var(--app-shadow-soft)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, size: 'medium' },
        styleOverrides: {
          root: {
            ...typography.buttonS,
            borderRadius: 'var(--app-radius-xs)',
            minWidth: 0,
            transition: 'background-color var(--app-motion-default) var(--app-easing), border-color var(--app-motion-default) var(--app-easing), color var(--app-motion-default) var(--app-easing), box-shadow var(--app-motion-default) var(--app-easing)',
            '&:focus-visible': {
              outline: 'var(--app-border-width) solid var(--app-color-primary)',
              outlineOffset: 'var(--app-space-xs)',
              boxShadow: '0 0 0 var(--app-space-xs) var(--app-color-focus-ring)',
            },
            '&.MuiButton-colorError': {
              backgroundColor: 'var(--app-color-surface)',
              border: 'var(--app-border-width) solid var(--app-color-danger)',
              color: 'var(--app-color-danger)',
              '&:hover': { backgroundColor: 'var(--app-color-danger-soft)' },
              '&.Mui-disabled': {
                backgroundColor: 'var(--app-color-surface)',
                borderColor: 'var(--app-color-border)',
                color: 'var(--app-color-disabled)',
              },
            },
          },
          sizeSmall: { minHeight: 'var(--app-control-s)', paddingInline: 'var(--app-space-s)' },
          sizeMedium: { minHeight: 'var(--app-control-m)', paddingInline: 'var(--app-space-m)' },
          sizeLarge: { minHeight: 'var(--app-control-l)', paddingInline: 'var(--app-space-l)' },
          contained: {
            backgroundColor: 'var(--app-color-primary)',
            boxShadow: 'none',
            color: 'var(--app-color-on-primary)',
            '&:hover': { backgroundColor: 'var(--app-color-primary-hover)', boxShadow: 'none' },
            '&.Mui-disabled': {
              backgroundColor: 'var(--app-color-surface-muted)',
              color: 'var(--app-color-disabled)',
            },
          },
          outlined: {
            backgroundColor: 'var(--app-color-surface)',
            borderColor: 'var(--app-color-border-strong)',
            color: 'var(--app-color-text)',
            '&:hover': {
              backgroundColor: 'var(--app-color-action-hover)',
              borderColor: 'var(--app-color-border-strong)',
            },
            '&.Mui-disabled': { borderColor: 'var(--app-color-border)', color: 'var(--app-color-disabled)' },
          },
          text: {
            color: 'var(--app-color-text)',
            '&:hover': { backgroundColor: 'var(--app-color-action-hover)' },
            '&.Mui-disabled': { color: 'var(--app-color-disabled)' },
          },
        },
      },
      MuiIconButton: {
        defaultProps: { size: 'medium' },
        styleOverrides: {
          root: {
            borderRadius: 'var(--app-radius-xs)',
            color: 'var(--app-color-text)',
            '&:hover': { backgroundColor: 'var(--app-color-action-hover)' },
            '&.Mui-disabled': { color: 'var(--app-color-disabled)' },
            '&.MuiIconButton-colorError': { color: 'var(--app-color-danger)' },
            '&.MuiIconButton-colorError:hover': { backgroundColor: 'var(--app-color-danger-soft)' },
          },
          sizeSmall: {
            height: 'var(--app-control-s)',
            width: 'var(--app-control-s)',
            '& .MuiSvgIcon-root': { fontSize: 'var(--app-icon-s)' },
          },
          sizeMedium: {
            height: 'var(--app-control-m)',
            width: 'var(--app-control-m)',
            '& .MuiSvgIcon-root': { fontSize: 'var(--app-icon-m)' },
          },
          sizeLarge: {
            height: 'var(--app-control-l)',
            width: 'var(--app-control-l)',
            '& .MuiSvgIcon-root': { fontSize: 'var(--app-icon-l)' },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 'var(--app-radius-xs)',
            minHeight: 'var(--app-control-m)',
            backgroundColor: 'var(--app-color-surface)',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--app-color-border-strong)' },
            '&.Mui-focused': { boxShadow: '0 0 0 var(--app-space-xs) var(--app-color-focus-ring)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--app-color-primary)', borderWidth: 2 },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--app-color-danger)' },
            '&.Mui-disabled': { backgroundColor: 'var(--app-color-surface-muted)' },
          },
          input: { ...typography.bodyS, padding: '0 var(--app-space-m)' },
          inputSizeSmall: { padding: '0 var(--app-space-m)' },
          multiline: { alignItems: 'flex-start', minHeight: '7.5rem', padding: 'var(--app-space-m)' },
          notchedOutline: { borderColor: 'var(--app-color-border)' },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            ...typography.labelS,
            height: 'var(--app-avatar-m)',
            width: 'var(--app-avatar-m)',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { ...typography.labelS, color: 'var(--app-color-text)' } },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { ...typography.captionXs, marginInline: 0, color: 'var(--app-color-text-muted)' },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: { label: typography.bodyS },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            borderRadius: 'var(--app-radius-xs)',
            color: 'var(--app-color-border-strong)',
            padding: 'var(--app-space-xs)',
            '& .MuiSvgIcon-root': { fontSize: 'var(--app-icon-m)' },
            '&.Mui-checked': { color: 'var(--app-color-primary)' },
            '&.Mui-disabled': { color: 'var(--app-color-disabled)' },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { height: '1.75rem', padding: '0.25rem', width: '2.75rem' },
          switchBase: {
            padding: '0.375rem',
            '&.Mui-checked': {
              color: 'var(--app-color-surface)',
              transform: 'translateX(1rem)',
              '& + .MuiSwitch-track': { backgroundColor: 'var(--app-color-primary)', opacity: 1 },
            },
            '&.Mui-disabled + .MuiSwitch-track': { backgroundColor: 'var(--app-color-disabled)', opacity: 1 },
          },
          thumb: { boxShadow: 'none', height: '1rem', width: '1rem' },
          track: { borderRadius: 'var(--app-radius-pill)', backgroundColor: 'var(--app-color-surface-muted)', opacity: 1 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { ...typography.captionXs, borderRadius: 'var(--app-radius-pill)', height: 28 },
          sizeSmall: { height: 24, paddingInline: 'var(--app-space-xs)' },
          label: { paddingInline: 'var(--app-space-m)' },
          labelSmall: { paddingInline: 'var(--app-space-s)' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            ...typography.captionXs,
            backgroundColor: 'var(--app-color-text)',
            borderRadius: 'var(--app-radius-xs)',
            color: 'var(--app-color-surface)',
            padding: 'var(--app-space-s)',
          },
          arrow: { color: 'var(--app-color-text)' },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { border: 'var(--app-border-width) solid var(--app-color-border)', borderRadius: 'var(--app-radius-s)' },
          list: { padding: 'var(--app-space-s)' },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            ...typography.bodyS,
            borderRadius: 'var(--app-radius-xs)',
            minHeight: 'var(--app-control-m)',
            paddingInline: 'var(--app-space-m)',
            '&.Mui-selected': { backgroundColor: 'var(--app-color-action-selected)' },
            '&.Mui-disabled': { color: 'var(--app-color-disabled)' },
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: { border: 'var(--app-border-width) solid var(--app-color-border)', borderRadius: 'var(--app-radius-s)' },
          option: {
            ...typography.bodyS,
            borderRadius: 'var(--app-radius-xs)',
            minHeight: 'var(--app-control-m)',
            marginInline: 'var(--app-space-s)',
          },
          noOptions: typography.bodyS,
          loading: typography.bodyS,
        },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-xs)' } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: 'var(--app-border-width) solid var(--app-color-border)',
            borderRadius: 'var(--app-radius-s)',
            boxShadow: 'var(--app-shadow-surface)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { ...typography.headingM, padding: 'var(--app-space-l) var(--app-space-l) var(--app-space-s)' } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: 'var(--app-space-m) var(--app-space-l)' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { gap: 'var(--app-space-s)', padding: 'var(--app-space-m) var(--app-space-l) var(--app-space-l)' } },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 'var(--app-control-m)' },
          indicator: { borderRadius: 'var(--app-radius-pill)', height: 'var(--app-border-width)' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { ...typography.labelS, borderRadius: 'var(--app-radius-xs)', minHeight: 'var(--app-control-m)', minWidth: 0 },
        },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-s)' } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { ...typography.bodyS, borderColor: 'var(--app-color-border)' },
          head: {
            ...typography.labelS,
            backgroundColor: 'var(--app-color-surface-muted)',
            color: 'var(--app-color-text-muted)',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color var(--app-motion-fast) var(--app-easing)',
            '&.MuiTableRow-hover:hover': { backgroundColor: colors.actionHover },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 'var(--app-radius-xs)' } },
      },
    },
  });
}

/** Fixed light MUI profile used only by rendered Public Page content. */
export function createPublicPageTheme() {
  return createAppTheme('light');
}
