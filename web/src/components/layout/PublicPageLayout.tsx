import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { PublicPageStyleBoundary } from '../public-page-blocks/PublicPageStyleBoundary';

export function PublicPageLayout() {
  return (
    <PublicPageStyleBoundary>
      <Box component="main" sx={{ minHeight: '100dvh', bgcolor: '#fff', color: '#111' }}>
        <Outlet />
      </Box>
    </PublicPageStyleBoundary>
  );
}
