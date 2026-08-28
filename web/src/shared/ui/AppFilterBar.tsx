import {
  Box,
  ButtonBase,
  Chip,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
  type BoxProps,
} from '@mui/material';
import { useState } from 'react';
import { AppIcons } from './AppIcons';

type AppFilterBarProps = BoxProps & {
  mobileLabel?: string;
  mobileTitle?: string;
  activeFiltersCount?: number;
};

export function AppFilterBar({
  children,
  sx,
  className,
  mobileLabel,
  mobileTitle,
  activeFiltersCount,
  ...props
}: AppFilterBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const FilterIcon = AppIcons.filters;
  const CloseIcon = AppIcons.close;
  const countVisible = typeof activeFiltersCount === 'number' && activeFiltersCount > 0;

  if (isMobile) {
    return (
      <>
        <ButtonBase
          onClick={() => setIsMobileOpen(true)}
          className="app-filter-bar app-filter-bar__trigger"
        >
          <Box className="app-filter-bar__trigger-content">
            <Box className="app-filter-bar__trigger-label">
              <Box className="app-filter-bar__icon">
                <FilterIcon fontSize="small" />
              </Box>
              <Box className="app-filter-bar__label-copy">
                <Typography variant="subtitle2" className="app-filter-bar__label-title">
                  {mobileTitle ?? mobileLabel}
                </Typography>
                <Typography variant="body2" noWrap className="app-filter-bar__label-subtitle">
                  {mobileLabel}
                </Typography>
              </Box>
            </Box>
            {countVisible ? (
              <Chip size="small" color="primary" label={activeFiltersCount} className="app-badge" />
            ) : null}
          </Box>
        </ButtonBase>

        <Drawer
          anchor="left"
          open={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          slotProps={{ paper: { className: 'app-filter-bar__drawer-paper' } }}
        >
          <Box className="app-filter-bar__drawer">
            <Box className="app-filter-bar__drawer-header">
              <Box className="app-filter-bar__drawer-title">
                <Typography variant="h6">{mobileTitle ?? mobileLabel}</Typography>
                <Typography variant="body2" className="app-filter-bar__label-subtitle">
                  {mobileLabel}
                </Typography>
              </Box>
              <Box className="app-filter-bar__drawer-actions">
                <Chip
                  size="small"
                  icon={<FilterIcon fontSize="small" />}
                  label={countVisible ? activeFiltersCount : mobileLabel}
                  className="app-badge"
                />
                <IconButton onClick={() => setIsMobileOpen(false)} aria-label="Close filters">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box className={['app-filter-bar', 'app-filter-bar--drawer', className].filter(Boolean).join(' ')} sx={sx}>
              <Box className="app-filter-bar__grid">{children}</Box>
            </Box>
          </Box>
        </Drawer>
      </>
    );
  }

  return (
    <Box className={['app-filter-bar', className].filter(Boolean).join(' ')} sx={sx} {...props}>
      <Box className="app-filter-bar__grid">{children}</Box>
    </Box>
  );
}
