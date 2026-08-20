import { Box, Paper, styled } from '@mui/material';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import { PublicPageRenderer } from '../public-page-blocks/PublicPageRenderer';
import type { PreviewDevice } from './DeviceSwitcher';
import type { PublicPageEditorRenderProps } from '../public-page-blocks/PublicPageRenderer';

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
  overflow: 'auto', height: '100%', minHeight: 0, boxSizing: 'border-box', display: 'flex',
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
  editor,
  framed = false,
  interactive = true,
  ariaLabel,
}: {
  document: PublicPageDocument;
  device: PreviewDevice;
  mediaUrls?: ReadonlyMap<string, string>;
  editor?: PublicPageEditorRenderProps;
  framed?: boolean;
  interactive?: boolean;
  ariaLabel?: string;
}) {
  const showPhoneFrame = Boolean(editor) || framed;
  return (
    <PreviewScroller role={ariaLabel ? 'region' : undefined} tabIndex={ariaLabel ? 0 : undefined} aria-label={ariaLabel}
      sx={{ py: editor ? { xs: 5, md: 6 } : { xs: 1, md: 3 }, px: editor ? 1 : framed ? 1 : { xs: 1, md: 3 }, bgcolor: 'grey.100' }}>
      <PreviewFrame
        {...(!interactive ? { inert: true, 'aria-hidden': true } : {})}
        sx={{
          width: editor
            ? `${PUBLIC_PAGE_PREVIEW_GEOMETRY.widths[device] + PUBLIC_PAGE_PREVIEW_GEOMETRY.editorDragGutter + PUBLIC_PAGE_PREVIEW_GEOMETRY.frameBorder * 2}px`
            : framed
              ? `min(100%, ${PUBLIC_PAGE_PREVIEW_GEOMETRY.framedMobileOuterWidth}px)`
              : `min(100%, ${PUBLIC_PAGE_PREVIEW_GEOMETRY.widths[device]}px)`,
          pl: editor ? `${PUBLIC_PAGE_PREVIEW_GEOMETRY.editorDragGutter}px` : 0,
          ...(!interactive ? { '& a, & button, & [role="button"]': { pointerEvents: 'none' } } : {}),
        }}
      >
      <PhoneSurface
        className={editor ? 'public-page-editor-preview-surface' : undefined}
        sx={{
          width: showPhoneFrame ? `${PUBLIC_PAGE_PREVIEW_GEOMETRY.widths[editor ? device : 'mobile']}px` : '100%',
          border: showPhoneFrame ? undefined : 0,
          boxSizing: showPhoneFrame ? 'content-box' : 'border-box',
          borderRadius: showPhoneFrame ? undefined : 0,
          boxShadow: showPhoneFrame ? undefined : 'none',
          overflow: editor ? 'visible' : 'hidden',
          transition: 'width 180ms ease',
          '& > * > .MuiContainer-root': editor ? {
            width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
          } : undefined,
        }}
      >
        <PublicPageRenderer document={document} mediaUrls={mediaUrls} editor={editor} />
      </PhoneSurface>
      </PreviewFrame>
    </PreviewScroller>
  );
}
