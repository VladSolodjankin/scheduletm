import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import { rem } from '../theme/constants';

type AppSectionHeaderProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function AppSectionHeader({ title, description, action, icon }: AppSectionHeaderProps) {
  const theme = useTheme();

  if (!title && !description && !action) {
    return null;
  }

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{
        justifyContent: 'space-between',
        alignItems: { sm: 'flex-start' },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: 'flex-start' }}>
        {icon ? (
          <Box
            sx={{
              width: rem(40),
              height: rem(40),
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              border: `${rem(1)} solid ${alpha(theme.palette.primary.main, 0.14)}`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        ) : null}

        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {title ? <Typography variant="h6">{title}</Typography> : null}
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>
      </Stack>

      {action ? <Stack sx={{ flexShrink: 0 }}>{action}</Stack> : null}
    </Stack>
  );
}
