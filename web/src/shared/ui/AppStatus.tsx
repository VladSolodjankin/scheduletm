import { Alert, Box, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { AppSurface } from './AppSurface';
import { AppIcons } from './AppIcons';

type AppStatusMessageProps = {
  severity: 'error' | 'success' | 'info' | 'warning';
  message: string;
};

type AppEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

type AppLoadingStateProps = {
  lines?: number;
  hasHeader?: boolean;
};

export function AppStatusMessage({ severity, message }: AppStatusMessageProps) {
  return <Alert severity={severity} variant="outlined">{message}</Alert>;
}

export function AppEmptyState({ title, description, action }: AppEmptyStateProps) {
  return (
    <AppSurface>
      <Stack spacing={1.5} sx={{ alignItems: 'center', py: { xs: 3, sm: 4 }, textAlign: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            display: 'grid',
            placeItems: 'center',
            color: 'text.secondary'
          }}
        >
          <AppIcons.info fontSize="small" />
        </Box>
        <Stack spacing={0.5}>
          <Typography variant="h6">{title}</Typography>
          {description ? <Typography variant="body2" color="text.secondary">{description}</Typography> : null}
        </Stack>
        {action}
      </Stack>
    </AppSurface>
  );
}

export function AppLoadingState({ lines = 4, hasHeader = true }: AppLoadingStateProps) {
  return (
    <AppSurface>
      <Stack spacing={1.5}>
        {hasHeader ? <Skeleton variant="rounded" height={24} width="34%" /> : null}
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={`loading-line-${index}`}
            variant="rounded"
            height={index === lines - 1 ? 44 : 56}
            width={index === lines - 1 ? '28%' : '100%'}
          />
        ))}
      </Stack>
    </AppSurface>
  );
}
