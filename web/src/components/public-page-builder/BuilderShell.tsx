import { Box, Paper } from '@mui/material';
import type { ReactNode } from 'react';

export function BuilderShell({
  toolbar,
  preview,
  bottomNavigation,
}: {
  toolbar: ReactNode;
  preview: ReactNode;
  bottomNavigation?: ReactNode;
}) {
  return (
    <Box sx={{ height: '100dvh', minHeight: '100dvh', display: 'grid', gridTemplateRows: bottomNavigation ? 'auto minmax(0, 1fr) auto' : 'auto minmax(0, 1fr)' }}>
      <Paper square elevation={0} sx={{ px: { xs: 1.25, md: 2.5 }, py: 1.5, borderBottom: 1, borderColor: 'divider', zIndex: 2 }}>{toolbar}</Paper>
      <Box sx={{ minWidth: 0, minHeight: 0 }}>{preview}</Box>
      {bottomNavigation ? <Paper square elevation={8} sx={{ zIndex: 5 }}>{bottomNavigation}</Paper> : null}
    </Box>
  );
}
