import { Box, Paper, styled } from '@mui/material';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import { PublicPageRenderer } from '../public-page-blocks/PublicPageRenderer';
import type { PreviewDevice } from './DeviceSwitcher';
import type { PublicPageEditorRenderProps } from '../public-page-blocks/PublicPageRenderer';
import type { PublicBookingService } from '../../shared/types/api';

export const PUBLIC_PAGE_PREVIEW_GEOMETRY = {
  widths: { mobile: 375, tablet: 768, desktop: 1280 },
  editorDragGutter: 64,
  frameBorder: 10,
  framedMobileOuterWidth: 395,
  frameRadius: 32,
  contentRadius: 22,
  shadow: 'rgba(0,0,0,.1) 0 7px 28px 7px',
} as const satisfies {
  widths: Record<PreviewDevice, number>;
  editorDragGutter: number;
  frameBorder: number;
  framedMobileOuterWidth: number;
  frameRadius: number;
  contentRadius: number;
  shadow: string;
};

const PreviewScroller = styled(Box)({
  overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable both-edges', height: '100%', minHeight: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
});
const PreviewFrame = styled(Box)({
  marginInline: 'auto', boxSizing: 'border-box', minHeight: '100%', display: 'flex', flexDirection: 'column',
});
const PhoneSurface = styled(Paper)(({ theme }) => ({
  minHeight: '100%', flex: '1 0 auto', display: 'flex', flexDirection: 'column', border: `${PUBLIC_PAGE_PREVIEW_GEOMETRY.frameBorder}px solid ${theme.palette.common.white}`,
  boxSizing: 'content-box',
  borderRadius: PUBLIC_PAGE_PREVIEW_GEOMETRY.frameRadius, boxShadow: PUBLIC_PAGE_PREVIEW_GEOMETRY.shadow, backgroundClip: 'padding-box',
  '& > *': { width: '100%', minWidth: 0, flex: '1 0 auto', boxSizing: 'border-box' },
}));

export function ResponsivePreview({
  document,
  device,
  mediaUrls,
  services,
  editor,
  framed = false,
  interactive = true,
  compactEditor = false,
  ariaLabel,
  controls,
}: {
  document: PublicPageDocument;
  device: PreviewDevice;
  mediaUrls?: ReadonlyMap<string, string>;
  services?: readonly PublicBookingService[];
  editor?: PublicPageEditorRenderProps;
  framed?: boolean;
  interactive?: boolean;
  compactEditor?: boolean;
  ariaLabel?: string;
  controls?: ReactNode;
}) {
  const showPhoneFrame = Boolean(editor) || framed;
  const virtualWidth = PUBLIC_PAGE_PREVIEW_GEOMETRY.widths[device];
  const editorOuterWidth = virtualWidth
    + (compactEditor ? 0 : PUBLIC_PAGE_PREVIEW_GEOMETRY.editorDragGutter)
    + PUBLIC_PAGE_PREVIEW_GEOMETRY.frameBorder * 2;
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [editorScale, setEditorScale] = useState(1);
  const [scaledFrameHeight, setScaledFrameHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!editor) {return;}
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!stage || !frame) {return;}
    const update = () => {
      const nextScale = Math.min(1, stage.clientWidth / editorOuterWidth);
      setEditorScale(nextScale);
      setScaledFrameHeight(Math.ceil(frame.scrollHeight * nextScale));
    };
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(frame);
    update();
    return () => {
      observer.disconnect();
    };
  }, [editor, editorOuterWidth]);

  return (
    <PreviewScroller data-public-page-preview-scroller role={ariaLabel ? 'region' : undefined} tabIndex={ariaLabel ? 0 : undefined} aria-label={ariaLabel}
      sx={{
        pt: editor ? { xs: 1.25, md: 3 } : { xs: 1, md: 3 },
        pb: editor ? 'calc(80px + env(safe-area-inset-bottom))' : { xs: 1, md: 3 },
        px: editor ? { xs: 1.25, md: 3 } : framed ? 1 : { xs: 1, md: 3 },
        scrollPaddingBottom: editor ? 'calc(80px + env(safe-area-inset-bottom))' : undefined,
        gap: editor ? 1.5 : 0,
        bgcolor: 'background.default',
      }}>
      {controls ? <Box sx={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{controls}</Box> : null}
      <Box ref={stageRef} sx={{ width: '100%', minWidth: 0, flexShrink: 0 }}>
        <Box sx={{
          width: editor ? `${editorOuterWidth * editorScale}px` : '100%',
          height: editor && scaledFrameHeight !== null ? `${scaledFrameHeight}px` : undefined,
          minHeight: editor ? 0 : '100%', mx: 'auto', position: 'relative',
        }}>
          <PreviewFrame
            ref={frameRef}
            {...(!interactive ? { inert: true, 'aria-hidden': true } : {})}
            sx={{
              minHeight: editor ? 0 : '100%',
              flexShrink: 0,
              width: editor
                ? `${editorOuterWidth}px`
                : framed
                  ? `min(100%, ${PUBLIC_PAGE_PREVIEW_GEOMETRY.framedMobileOuterWidth}px)`
                  : `min(100%, ${virtualWidth}px)`,
              pl: editor && !compactEditor ? `${PUBLIC_PAGE_PREVIEW_GEOMETRY.editorDragGutter}px` : 0,
              transform: editor ? `scale(${editorScale})` : undefined,
              transformOrigin: editor ? 'top left' : undefined,
              ...(!interactive ? { '& a, & button, & [role="button"]': { pointerEvents: 'none' } } : {}),
            }}
          >
            <PhoneSurface
              className={editor ? `public-page-editor-preview-surface${compactEditor ? ' public-page-editor-preview-surface--compact' : ''}` : undefined}
              sx={(theme) => ({
                width: editor
                  ? `${virtualWidth}px`
                  : framed
                    ? `calc(100% - ${PUBLIC_PAGE_PREVIEW_GEOMETRY.frameBorder * 2}px)`
                    : showPhoneFrame ? `${PUBLIC_PAGE_PREVIEW_GEOMETRY.widths.mobile}px` : '100%',
                maxWidth: framed && !editor ? `${PUBLIC_PAGE_PREVIEW_GEOMETRY.widths.mobile}px` : undefined,
                border: showPhoneFrame ? undefined : 0,
                boxSizing: showPhoneFrame ? 'content-box' : 'border-box',
                borderRadius: showPhoneFrame ? undefined : 0,
                boxShadow: showPhoneFrame ? undefined : 'none',
                overflow: editor ? 'visible' : 'hidden',
                transition: theme.transitions.create('width'),
                '& > * > .MuiContainer-root': editor ? {
                  width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
                } : undefined,
              })}
            >
              <PublicPageRenderer document={document} mediaUrls={mediaUrls} services={services} editor={editor} />
            </PhoneSurface>
          </PreviewFrame>
        </Box>
      </Box>
    </PreviewScroller>
  );
}
