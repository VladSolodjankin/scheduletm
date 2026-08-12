import { Box, Paper } from '@mui/material';
import type { ReactNode } from 'react';

export function BuilderShell({
  toolbar,
  preview,
}: {
  toolbar: ReactNode;
  preview: ReactNode;
}) {
  return (
    <Box sx={{ height: '100dvh', minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <Paper square sx={{ p: 1.5, zIndex: 2 }}>{toolbar}</Paper>
      <Box sx={{ minWidth: 0, minHeight: 0 }}>{preview}</Box>
    </Box>
  );
}
