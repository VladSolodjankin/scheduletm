import { Box, Paper } from '@mui/material';
import { useRef, type ReactNode } from 'react';

export function BuilderShell({
  toolbar,
  preview,
  bottomNavigation,
}: {
  toolbar: ReactNode;
  preview: ReactNode;
  bottomNavigation?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const touchYRef = useRef<number | null>(null);
  const scrollPreview = (deltaY: number) => {
    const scroller = rootRef.current?.querySelector<HTMLElement>('[data-public-page-preview-scroller]');
    if (scroller) {scroller.scrollTop += deltaY;}
  };
  return (
    <Box ref={rootRef} sx={{ position: 'relative', width: '100%', maxWidth: '100%', minWidth: 0, height: '100%', minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <Paper square elevation={0} sx={{ minWidth: 0, px: { xs: 1.25, md: 2.5 }, py: 1.5, borderBottom: 1, borderColor: 'divider', zIndex: 2 }}>{toolbar}</Paper>
      <Box sx={{ minWidth: 0, minHeight: 0 }}>{preview}</Box>
      {bottomNavigation ? (
        <Box
          onWheel={(event) => {
            if (!event.deltaY) {return;}
            const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rootRef.current?.clientHeight ?? 1 : 1;
            scrollPreview(event.deltaY * multiplier);
          }}
          onTouchStart={(event) => { touchYRef.current = event.touches[0]?.clientY ?? null; }}
          onTouchMove={(event) => {
            const y = event.touches[0]?.clientY;
            if (y === undefined || touchYRef.current === null) {return;}
            scrollPreview(touchYRef.current - y);
            touchYRef.current = y;
          }}
          onTouchEnd={() => { touchYRef.current = null; }}
          onTouchCancel={() => { touchYRef.current = null; }}
          sx={{ position: 'absolute', insetInline: 0, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 5, display: 'flex', justifyContent: 'center', px: 2, pointerEvents: 'none', touchAction: 'none', '& > *': { pointerEvents: 'auto' } }}
        >
          {bottomNavigation}
        </Box>
      ) : null}
    </Box>
  );
}
