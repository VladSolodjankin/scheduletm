import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

export function PublicPageLayout() {
  return (
    <Box component="main" sx={{ minHeight: '100dvh', bgcolor: '#fff', color: '#111' }}>
      <Outlet />
    </Box>
  );
}
