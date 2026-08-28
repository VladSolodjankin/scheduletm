import { Paper, Stack, type PaperProps, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
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
  className,
  ...props
}: AppSurfaceProps) {
  return (
    <Paper
      variant="outlined"
      elevation={0}
      className={['app-surface', className].filter(Boolean).join(' ')}
      sx={sx}
      {...props}
    >
      {(title || description || action) && (
        <Stack className="app-surface__header">
          <AppSectionHeader title={title} description={description} action={action} icon={icon} />
        </Stack>
      )}

      <Stack className="app-surface__content" sx={contentSx}>
        {children}
      </Stack>
    </Paper>
  );
}
