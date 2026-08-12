import { Box, Paper, styled } from '@mui/material';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import { PublicPageRenderer } from '../public-page-blocks/PublicPageRenderer';
import type { PreviewDevice } from './DeviceSwitcher';
import type { PublicPageEditorRenderProps } from '../public-page-blocks/PublicPageRenderer';

const widths: Record<PreviewDevice, number> = { mobile: 390, tablet: 768, desktop: 1280 };
const editorDragGutter = 64;
const editorFrameBorder = 10;

const PreviewScroller = styled(Box)({
  overflow: 'auto', height: '100%', minHeight: 0, boxSizing: 'border-box', display: 'flex',
});
const PreviewFrame = styled(Box)({
  marginInline: 'auto', boxSizing: 'border-box', minHeight: '100%', display: 'flex', flexDirection: 'column',
});
const PhoneSurface = styled(Paper)(({ theme }) => ({
  minHeight: '100%', flex: '1 0 auto', display: 'flex', flexDirection: 'column', border: `${theme.spacing(1.25)} solid ${theme.palette.common.white}`,
  boxSizing: 'content-box',
  borderRadius: 32, boxShadow: '0 18px 45px rgba(0,0,0,.24)', backgroundClip: 'padding-box',
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
            ? `${widths[device] + editorDragGutter + editorFrameBorder * 2}px`
            : framed
              ? `min(100%, ${widths.mobile + editorFrameBorder * 2}px)`
              : `min(100%, ${widths[device]}px)`,
          pl: editor ? `${editorDragGutter}px` : 0,
          ...(!interactive ? { '& a, & button, & [role="button"]': { pointerEvents: 'none' } } : {}),
        }}
      >
      <PhoneSurface
        sx={{
          width: editor ? `${widths[device]}px` : '100%',
          border: showPhoneFrame ? undefined : 0,
          boxSizing: editor ? 'content-box' : 'border-box',
          borderRadius: showPhoneFrame ? undefined : 0,
          boxShadow: showPhoneFrame ? undefined : 'none',
          overflow: editor ? 'visible' : 'hidden',
          transition: 'width 180ms ease',
          '--public-page-editor-drag-gutter': `${editorDragGutter}px`,
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
