import {
  Box,
  ButtonBase,
  Chip,
  Drawer,
  Stack,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
  type BoxProps,
} from '@mui/material';
import { useState } from 'react';
import { APP_SHADOWS, APP_SIZING, APP_SPACING } from '../theme/constants';
import { AppIcons } from './AppIcons';

type AppFilterBarProps = BoxProps & {
  mobileLabel?: string;
  mobileTitle?: string;
  activeFiltersCount?: number;
};

export function AppFilterBar({
  children,
  sx,
  mobileLabel,
  mobileTitle,
  activeFiltersCount,
  ...props
}: AppFilterBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const FilterIcon = AppIcons.filters;

  const panelSx = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: `${APP_SIZING.surfaceRadius}px`,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.palette.mode === 'light' ? APP_SHADOWS.softLight : APP_SHADOWS.softDark,
  } as const;

  const gridSx = {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gap: 1.5,
    gridTemplateColumns: isMobile
      ? 'minmax(0, 1fr)'
      : 'repeat(auto-fit, minmax(180px, 1fr))',
    p: APP_SPACING.surfacePadding,
    alignItems: 'start',
  } as const;

  if (isMobile) {
    return (
      <>
        <ButtonBase
          onClick={() => setIsMobileOpen(true)}
          sx={{
            width: '100%',
            textAlign: 'left',
            ...panelSx,
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              width: '100%',
              position: 'relative',
              zIndex: 1,
              px: 2,
              py: 1.75,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: APP_SIZING.radiusMd,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.main',
                  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.22),
                  flexShrink: 0,
                }}
              >
                <FilterIcon fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {mobileTitle ?? mobileLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {mobileLabel}
                </Typography>
              </Box>
            </Stack>

            {typeof activeFiltersCount === 'number' && activeFiltersCount > 0 ? (
              <Chip
                size="small"
                color="primary"
                label={activeFiltersCount}
                sx={{ fontWeight: 700, borderRadius: 999 }}
              />
            ) : null}
          </Stack>
        </ButtonBase>

        <Drawer
          anchor="left"
          open={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: 'min(92vw, 420px)',
                bgcolor: 'background.default',
              }
            }
          }}
        >
          <Stack spacing={2} sx={{ height: '100%', p: 2 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack spacing={0.25}>
                <Typography variant="h6">{mobileTitle ?? mobileLabel}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {mobileLabel}
                </Typography>
              </Stack>
              <Chip
                size="small"
                icon={<FilterIcon fontSize="small" />}
                label={typeof activeFiltersCount === 'number' && activeFiltersCount > 0 ? activeFiltersCount : mobileLabel}
                sx={{ borderRadius: 999 }}
              />
            </Stack>

            <Box sx={{ ...panelSx, flexGrow: 1, minHeight: 0, ...sx }}>
              <Box sx={gridSx}>{children}</Box>
            </Box>
          </Stack>
        </Drawer>
      </>
    );
  }

  return (
    <Box
      sx={{
        ...panelSx,
        ...sx,
      }}
      {...props}
    >
      <Box sx={gridSx}>{children}</Box>
    </Box>
  );
}
