import { Box, Stack, Typography, type BoxProps } from '@mui/material';
import type { ReactNode } from 'react';
import { APP_SPACING, APP_SIZING } from '../theme/constants';

type AppPageProps = BoxProps & {
  title: string;
  subtitle?: string;
  maxWidth?: number;
  action?: ReactNode;
};

export function AppPage({ title, subtitle, children, maxWidth, action, ...rest }: AppPageProps) {
  return (
    <Box
      sx={{
        maxWidth: maxWidth || APP_SIZING.contentMaxWidth,
        mx: 'auto',
        px: APP_SPACING.pageX,
        py: APP_SPACING.pageY,
        width: '100%'
      }}
      {...rest}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 3.5, justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}
      >
        <Stack spacing={APP_SPACING.pageHeaderGap} sx={{ minWidth: 0 }}>
          <Typography variant="h4">{title}</Typography>
          {subtitle && (
            <Typography color="text.secondary" variant="body1">
              {subtitle}
            </Typography>
          )}
        </Stack>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
      {children}
    </Box>
  );
}
