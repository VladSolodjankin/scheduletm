import { Box, Paper } from '@mui/material';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import { PublicPageRenderer } from '../public-page-blocks/PublicPageRenderer';
import type { PreviewDevice } from './DeviceSwitcher';

const widths: Record<PreviewDevice, number> = { mobile: 390, tablet: 768, desktop: 1280 };

export function ResponsivePreview({
  document,
  device,
  mediaUrls,
}: {
  document: PublicPageDocument;
  device: PreviewDevice;
  mediaUrls?: ReadonlyMap<string, string>;
}) {
  return (
    <Box sx={{ overflow: 'auto', p: { xs: 1, md: 3 }, height: '100%', bgcolor: 'grey.100' }}>
      <Paper
        sx={{
          width: `min(100%, ${widths[device]}px)`,
          minHeight: '100%',
          mx: 'auto',
          overflow: 'hidden',
          transition: 'width 180ms ease',
        }}
      >
        <PublicPageRenderer document={document} mediaUrls={mediaUrls} />
      </Paper>
    </Box>
  );
}
