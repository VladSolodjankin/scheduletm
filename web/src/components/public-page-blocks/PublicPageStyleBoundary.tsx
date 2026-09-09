import { ThemeProvider } from '@mui/material';
import type { CSSProperties, PropsWithChildren } from 'react';
import { APP_TOKENS } from '../../shared/theme/constants';
import { createPublicPageTheme } from '../../shared/theme/createAppTheme';

const publicPageTheme = createPublicPageTheme();
const colors = APP_TOKENS.colors.light;
const publicPageVariables = {
  display: 'contents',
  colorScheme: 'light',
  '--app-control-m': APP_TOKENS.publicPageBase.controlHeightM,
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
  '--app-shadow-soft': APP_TOKENS.shadow.softLight,
  '--app-shadow-surface': APP_TOKENS.shadow.surfaceLight,
} as CSSProperties;

/**
 * Keeps rendered Public Page UI on its fixed light profile when it appears
 * inside the light or dark Meetli cabinet. The DOM wrapper uses
 * `display: contents`, so it does not participate in DnD container layout.
 */
export function PublicPageStyleBoundary({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={publicPageTheme}>
      <div className="public-page-style-boundary" style={publicPageVariables}>{children}</div>
    </ThemeProvider>
  );
}
