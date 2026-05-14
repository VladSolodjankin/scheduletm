import { Paper, Stack, type PaperProps, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { APP_SHADOWS, APP_SIZING, APP_SPACING } from '../theme/constants';
import { AppSectionHeader } from './AppSectionHeader';

type AppSurfaceProps = PaperProps & {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  contentSx?: SxProps<Theme>;
};

export function AppSurface({
  title,
  description,
  action,
  icon,
  children,
  sx,
  contentSx,
  ...props
}: AppSurfaceProps) {
  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        p: APP_SPACING.surfacePadding,
        borderRadius: `${APP_SIZING.surfaceRadius}px`,
        borderColor: 'divider',
        boxShadow: (theme) => theme.palette.mode === 'light' ? APP_SHADOWS.softLight : APP_SHADOWS.softDark,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        ...sx
      }}
      {...props}
    >
      {(title || description || action) && (
        <Stack sx={{ mb: 2.5 }}>
          <AppSectionHeader title={title} description={description} action={action} icon={icon} />
        </Stack>
      )}

      <Stack spacing={2} sx={contentSx}>
        {children}
      </Stack>
    </Paper>
  );
}
