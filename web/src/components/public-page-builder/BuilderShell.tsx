import { Box, Paper, Stack } from '@mui/material';
import type { ReactNode } from 'react';

export function BuilderShell({
  toolbar,
  tree,
  preview,
  inspector,
}: {
  toolbar: ReactNode;
  tree: ReactNode;
  preview: ReactNode;
  inspector: ReactNode;
}) {
  return (
    <Box sx={{ height: '100dvh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <Paper square sx={{ p: 1.5, zIndex: 2 }}>{toolbar}</Paper>
      <Box sx={{ minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '17rem minmax(0, 1fr) 19rem' } }}>
        <Stack sx={{ p: 1.5, overflowY: 'auto', display: { xs: 'none', lg: 'flex' } }}>{tree}</Stack>
        <Box sx={{ minWidth: 0, minHeight: 0 }}>{preview}</Box>
        <Stack sx={{ p: 1.5, overflowY: 'auto', display: { xs: 'none', lg: 'flex' } }}>{inspector}</Stack>
      </Box>
    </Box>
  );
}
