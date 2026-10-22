import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { rem } from '../theme/constants';
import { AppStatusBadge } from './AppStatus';

type AppIntegrationPanelProps = {
  accentColor: string;
  icon: ReactNode;
  statusLabel: string;
  isConnected: boolean;
  title: string;
  description: string;
  actions: ReactNode;
  /** Optional small line under the title, e.g. the region a provider serves. */
  caption?: string;
};

export function AppIntegrationPanel({
  accentColor,
  icon,
  statusLabel,
  isConnected,
  title,
  description,
  actions,
  caption,
}: AppIntegrationPanelProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3,
        borderColor: alpha(accentColor, 0.18),
        background: `linear-gradient(180deg, ${alpha(accentColor, 0.09)} 0%, ${alpha(accentColor, 0.03)} 28%, #FFFFFF 100%)`,
        boxShadow: `0 ${rem(12)} ${rem(30)} ${alpha(accentColor, 0.08)}`,
      }}
    >
      <CardContent
        sx={{
          height: '100%',
          p: 2.5,
          '&:last-child': { pb: 2.5 },
        }}
      >
        <Stack spacing={2} sx={{ height: '100%', minHeight: 220, justifyContent: 'space-between' }}>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accentColor,
                    backgroundColor: alpha(accentColor, 0.12),
                    border: `${rem(1)} solid ${alpha(accentColor, 0.18)}`,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </Box>
                {caption ? (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {caption}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {title}
                  </Typography>
                )}
              </Stack>

              <AppStatusBadge
                label={statusLabel}
                tone={isConnected ? 'success' : 'neutral'}
                variant="outlined"
                sx={{
                  color: accentColor,
                  borderColor: alpha(accentColor, 0.24),
                  backgroundColor: alpha(accentColor, 0.08),
                  fontWeight: 600,
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Stack>
          <Box>{actions}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
