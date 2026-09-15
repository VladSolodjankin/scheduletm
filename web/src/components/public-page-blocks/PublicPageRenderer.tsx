import { Box, Chip, Container } from '@mui/material';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isBlockScheduledVisible, nextScheduleVisibilityChange } from '../../features/public-page-builder/model/schedule';
import type {
  PageSection,
  PageBlock,
  PublicPageDocument,
  SectionLayout,
} from '../../features/public-page-builder/types/publicPage';
import { BlockRenderer, sectionSurfaceRadius } from './BlockRenderer';
import { backgroundPresetCss } from '../../features/public-page-builder/config/backgroundPresets';
import {
  BLOCK_DRAG_HANDLE,
  PUBLIC_PAGE_DND_DRAG_CLASS,
  PUBLIC_PAGE_DND_GROUP,
  SECTION_DRAG_HANDLE,
  SMOOTH_DND_WRAPPER_CLASS,
  isBuilderDragPayload,
  useSmoothDndContainer,
  type BuilderDragPayload,
  type BuilderDropDestination,
  type SortableActivator,
} from '../public-page-builder/BuilderSortable';
import { resolvePublicPageThemeVariables } from './publicPageThemeVariables';
import { resolveLeadingAvatarSectionMarginTop } from './avatarPresentation';
import { ordinaryPublicPageLinkSx } from './blocks';
import '../public-page-builder/publicPageDnd.css';
import type { PublicBookingService } from '../../shared/types/api';
import { PublicPageStyleBoundary } from './PublicPageStyleBoundary';

const columnsByLayout: Record<SectionLayout, string> = {
  single: 'minmax(0, 1fr)',
  'two-equal': 'repeat(2, minmax(0, 1fr))',
  'one-third-two-thirds': 'minmax(0, 1fr) minmax(0, 2fr)',
  'two-thirds-one-third': 'minmax(0, 2fr) minmax(0, 1fr)',
  'three-equal': 'repeat(3, minmax(0, 1fr))',
  stack: 'minmax(0, 1fr)',
  'hero-overlay': 'minmax(0, 1fr)',
};
const SECTION_HORIZONTAL_SPACING_PX = 14;

export type PublicPageEditorRenderProps = {
  scheduleStatusLabel?: (visible: boolean) => string;
  selectedBlockId: string | null;
  onSelectBlock: (sectionId: string, blockId: string) => void;
  renderBlockActions: (section: PageSection, blockIndex: number) => ReactNode;
  renderSectionActions: (section: PageSection, sectionIndex: number) => ReactNode;
  blockAriaLabel: (blockName: string) => string;
  renderBlockDragHandle?: (section: PageSection, blockIndex: number, activator: SortableActivator) => ReactNode;
  renderSectionDragHandle?: (section: PageSection, sectionIndex: number, activator: SortableActivator) => ReactNode;
  renderSectionResizeHandle?: (section: PageSection, sectionIndex: number) => ReactNode;
  onDropItem: (payload: BuilderDragPayload, destination: BuilderDropDestination) => void;
};
function SectionRenderer({ section, sectionIndex, mediaUrlFor, theme, services, publicPageSlug, timezone, now, editor }: { section: PageSection; sectionIndex: number; mediaUrlFor: (id: string) => string | undefined; theme: PublicPageDocument['theme']; services: readonly PublicBookingService[]; publicPageSlug: string; timezone: string; now: number; editor?: PublicPageEditorRenderProps }) {
  const blockContainerRef = useRef<HTMLDivElement>(null);
  useSmoothDndContainer(blockContainerRef, {
    behaviour: 'move',
    groupName: PUBLIC_PAGE_DND_GROUP,
    orientation: 'vertical',
    dragHandleSelector: BLOCK_DRAG_HANDLE,
    animationDuration: 180,
    lockAxis: 'y',
    dragClass: PUBLIC_PAGE_DND_DRAG_CLASS,
    shouldAnimateDrop: () => false,
    getChildPayload: (index) => {
      const child = blockContainerRef.current!.children[index] as HTMLElement;
      return { type: 'block', blockId: child.dataset.blockId!, sourceSectionId: section.id };
    },
    shouldAcceptDrop: (_source, payload) => isBuilderDragPayload(payload) && payload.type !== 'section',
    onDrop: ({ addedIndex, payload }) => {
      if (addedIndex !== null && isBuilderDragPayload(payload)) {
        editor?.onDropItem(payload, { type: 'section', sectionId: section.id, index: addedIndex });
      }
    },
  }, Boolean(editor));
  const serviceIds = new Set(services.map(({ id }) => id));
  const isRenderableBlock = (block: PageBlock) => {
    if (!block.visible) {return false;}
    if (!isBlockScheduledVisible(block.schedule, timezone, now)) {return false;}
    if (block.type !== 'services') {return true;}
    return Array.isArray(block.content.serviceIds) && block.content.serviceIds.some((id) => typeof id === 'number' && serviceIds.has(id));
  };
  const hasRenderableBlocks = section.blocks.some(isRenderableBlock);
  if (!editor && (!section.visible || !hasRenderableBlocks)) {
    return null;
  }

  const backgroundUrl = section.design.backgroundMediaId ? mediaUrlFor(section.design.backgroundMediaId) : undefined;
  const isOff = section.design.variant === 'off';
  const borderWidth = isOff ? 0 : section.design.borderWidth ?? 0;
  const sectionRadius = sectionSurfaceRadius(
    section.design.borderRadius,
    theme.roundingStyle,
    theme.styleDefaults.sectionBorderRadius,
  );
  const sectionInlineMargin = section.design.horizontalMargin ? `${SECTION_HORIZONTAL_SPACING_PX}px` : '0px';
  const themeColors = theme.colors;
  const variantBackground = section.design.variant === 'primary' ? themeColors.primary : section.design.variant === 'secondary' ? themeColors.surface : 'transparent';
  const heading = isOff ? theme.styleDefaults.headingStyle : { ...theme.styleDefaults.headingStyle, ...Object.fromEntries(Object.entries(section.design.headingStyle).filter(([, value]) => value !== null)) };
  const text = isOff ? theme.styleDefaults.textStyle : { ...theme.styleDefaults.textStyle, ...Object.fromEntries(Object.entries(section.design.textStyle).filter(([, value]) => value !== null)) };
  const headingSize = !isOff && section.design.headingStyle.fontSize !== null ? `${section.design.headingStyle.fontSize / 16}rem` : null;
  const blockThemeSx = {
    ...resolvePublicPageThemeVariables(theme, section),
    color: 'var(--page-section-text)',
    fontFamily: theme.fontFamily,
    '& h1, & h2, & h3, & h4, & h5, & h6': { fontFamily: heading.fontFamily, fontWeight: heading.fontWeight, fontStyle: heading.fontStyle, color: 'var(--theme-heading-color)' },
    '& h1': { fontSize: headingSize ?? 'var(--theme-h1-fontsize)', lineHeight: 'var(--theme-h1-lineheight)', letterSpacing: 'var(--theme-h1-letterspacing)' },
    '& h2, & h4, & h5, & h6': { fontSize: headingSize ?? 'var(--theme-h2-fontsize)', lineHeight: 'var(--theme-h2-lineheight)', letterSpacing: 'var(--theme-h2-letterspacing)' },
    '& h3': { fontSize: headingSize ?? 'var(--theme-h3-fontsize)', lineHeight: 'var(--theme-h3-lineheight)', letterSpacing: 'var(--theme-h3-letterspacing)' },
    '& p:not([data-public-page-richtext-size])': { fontFamily: text.fontFamily, fontSize: `${text.fontSize / 16}rem`, fontWeight: text.fontWeight, fontStyle: text.fontStyle, color: 'var(--theme-text-color)', lineHeight: 'var(--theme-text-md-lineheight)', letterSpacing: 'var(--theme-text-md-letterspacing)' },
  } as const;
  const leadingAvatarSectionRadius = (block: PageBlock, blockIndex: number) => (
    !isOff && block.type === 'avatar' && blockIndex === 0 ? sectionRadius : '0px'
  );
  const renderBlock = (block: PageSection['blocks'][number], blockIndex: number) => <Box
    key={block.id}
    data-editor-block-id={editor ? block.id : undefined}
    data-editor-section-id={editor ? section.id : undefined}
    data-public-page-leading-block={blockIndex === 0 ? 'true' : undefined}
    tabIndex={editor ? 0 : undefined}
    role={editor ? 'group' : undefined}
    aria-label={editor ? editor.blockAriaLabel(block.name) : undefined}
    onClick={editor ? () => editor.onSelectBlock(section.id, block.id) : undefined}
    onKeyDown={editor ? (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); editor.onSelectBlock(section.id, block.id); } } : undefined}
    sx={{
      position: 'relative', minWidth: 0,
      mt: editor ? 0 : `${resolveLeadingAvatarSectionMarginTop(block.type, blockIndex, section.design.paddingTop, isOff, block.content.layout)}px`,
      ...(!editor ? { '--avatar-leading-section-radius': leadingAvatarSectionRadius(block, blockIndex) } : {}),
      '&:hover .public-page-block-actions, &:focus-within .public-page-block-actions': { opacity: 1, pointerEvents: 'auto' },
    }}
  >
    {editor?.scheduleStatusLabel && (block.schedule.period || block.schedule.weekdays) ? <Chip size="small" sx={{ mb: 0.5 }} label={editor.scheduleStatusLabel(isBlockScheduledVisible(block.schedule, timezone, now))} /> : null}
    <PublicPageStyleBoundary>
      <BlockRenderer block={block} mediaUrlFor={mediaUrlFor} editor={Boolean(editor)} themeBorderRadius={theme.styleDefaults.blockBorderRadius}
        roundingStyle={theme.roundingStyle} services={services} publicPageSlug={publicPageSlug} />
    </PublicPageStyleBoundary>
    {editor ? editor.renderBlockActions(section, blockIndex) : null}
  </Box>;
  return (
    <Box
      component="section"
      aria-label={section.name}
      data-public-page-section-drag-target={editor ? section.id : undefined}
      data-public-page-section-variant={editor ? section.design.variant : undefined}
      data-public-page-section-block-count={editor ? section.blocks.length : undefined}
      sx={{
        bgcolor: isOff ? 'transparent' : section.design.backgroundColor ?? variantBackground,
        backgroundImage: !isOff && backgroundUrl ? `linear-gradient(rgba(0,0,0,${section.design.backgroundOverlay}), rgba(0,0,0,${section.design.backgroundOverlay})), url("${backgroundUrl}")` : undefined,
        backgroundSize: section.design.backgroundFit,
        backgroundPosition: section.design.backgroundPosition,
        backgroundRepeat: 'no-repeat',
        pt: editor || isOff ? 0 : `${section.design.paddingTop}px`,
        pb: editor || isOff ? 0 : `${section.design.paddingBottom}px`,
        pl: editor || isOff ? 0 : `calc(${SECTION_HORIZONTAL_SPACING_PX}px + ${borderWidth}px)`,
        pr: editor || isOff ? 0 : `calc(${SECTION_HORIZONTAL_SPACING_PX}px + ${borderWidth}px)`,
        borderRadius: isOff
          ? 0
          : sectionRadius,
        borderWidth: `${borderWidth}px`,
        borderStyle: 'solid',
        borderColor: isOff ? 'transparent' : section.design.borderColor ?? 'transparent',
        boxShadow: !isOff && section.design.shadow ? 4 : undefined,
        boxSizing: 'border-box',
        width: section.design.width === 'contained'
          ? `min(calc(100% - ${sectionInlineMargin} - ${sectionInlineMargin}), 720px)`
          : 'auto',
        ml: section.design.width === 'contained' ? 'auto' : sectionInlineMargin,
        mr: section.design.width === 'contained' ? 'auto' : sectionInlineMargin,
        '@media (max-width: 600px)': section.design.mobileVisible ? undefined : editor ? { opacity: 0.4 } : { display: 'none' },
        display: 'grid',
        gridTemplateColumns: editor ? 'minmax(0, 1fr)' : { xs: 'minmax(0, 1fr)', md: columnsByLayout[section.layout] },
        gap: 'var(--theme-link-offset)',
        minHeight: editor ? 52 : undefined,
        minWidth: 0,
        '& > *': { minWidth: 0 },
        position: 'relative',
        ...blockThemeSx,
        opacity: section.visible ? 1 : 0.55,
        '&:hover:not(:has([data-editor-block-id]:hover)) > .public-page-section-actions, &:focus-within:not(:has([data-editor-block-id]:focus-within)) > .public-page-section-actions': {
          opacity: 1,
          pointerEvents: 'auto',
        },
        '&:hover > .public-page-section-resize-handle, &:focus-within > .public-page-section-resize-handle': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      }}
    >
      {editor ? editor.renderSectionActions(section, sectionIndex) : null}
      {editor ? <Box ref={blockContainerRef} className="public-page-dnd-block-container" data-public-page-block-container={section.id}
        data-public-page-dnd-context={isOff ? 'page' : 'section'}
        sx={{
          pt: isOff ? 0 : `${section.design.paddingTop}px`,
          pb: isOff ? 0 : `${section.design.paddingBottom}px`,
          pl: isOff ? 0 : `calc(${SECTION_HORIZONTAL_SPACING_PX}px + ${borderWidth}px)`,
          pr: isOff ? 0 : `calc(${SECTION_HORIZONTAL_SPACING_PX}px + ${borderWidth}px)`,
        }}>
        {section.blocks.map((block, blockIndex) => <Box key={block.id}
          className={`${SMOOTH_DND_WRAPPER_CLASS} public-page-dnd-wrapper public-page-dnd-block-wrapper`}
          data-public-page-sortable="block" data-block-id={block.id}
          data-public-page-dnd-context={isOff ? 'page' : 'section'}
          sx={{
            mt: `${resolveLeadingAvatarSectionMarginTop(block.type, blockIndex, section.design.paddingTop, isOff, block.content.layout)}px`,
            ...blockThemeSx,
            '--avatar-leading-section-radius': leadingAvatarSectionRadius(block, blockIndex),
          }}>
          <Box className="public-page-dnd-block-shell">
            {editor.renderBlockDragHandle?.(section, blockIndex, {})}
            {renderBlock(block, blockIndex)}
          </Box>
        </Box>)}
      </Box> : section.blocks.map((block, blockIndex) => ({ block, blockIndex })).filter(({ block }) => isRenderableBlock(block))
        .map(({ block, blockIndex }) => renderBlock(block, blockIndex))}
      {editor && !isOff && section.blocks.length > 0 ? editor.renderSectionResizeHandle?.(section, sectionIndex) : null}
    </Box>
  );
}

type PublicPageRendererProps = { document: PublicPageDocument; mediaUrls?: ReadonlyMap<string, string>; services?: readonly PublicBookingService[]; editor?: PublicPageEditorRenderProps };

function PublicPageRendererContent({ document, mediaUrls, services = [], editor }: PublicPageRendererProps) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {if (active) {setNow(Date.now());}});
    return () => {active = false;};
  }, [document]);
  useEffect(() => {
    const current = Date.now();
    const boundary = nextScheduleVisibilityChange(document, current);
    const refresh = () => setNow(Date.now());
    const timeout = boundary === null ? undefined : window.setTimeout(refresh, Math.min(2_147_483_647, Math.max(1, boundary - current + 1)));
    window.addEventListener('focus', refresh);
    window.document.addEventListener('visibilitychange', refresh);
    return () => {
      if (timeout !== undefined) {window.clearTimeout(timeout);}
      window.removeEventListener('focus', refresh);
      window.document.removeEventListener('visibilitychange', refresh);
    };
  }, [document, now]);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  useSmoothDndContainer(mainContainerRef, {
    behaviour: 'move', groupName: PUBLIC_PAGE_DND_GROUP, orientation: 'vertical',
    dragHandleSelector: SECTION_DRAG_HANDLE,
    animationDuration: 180, lockAxis: 'y', dragClass: PUBLIC_PAGE_DND_DRAG_CLASS,
    shouldAnimateDrop: () => false,
    getChildPayload: (index) => {
      const child = mainContainerRef.current!.children[index] as HTMLElement;
      return { type: 'section', sectionId: child.dataset.sectionId! };
    },
    shouldAcceptDrop: (_source, payload) => isBuilderDragPayload(payload),
    onDrop: ({ addedIndex, payload }) => {
      if (addedIndex !== null && isBuilderDragPayload(payload)) {
        editor?.onDropItem(payload, { type: 'main', index: addedIndex });
      }
    },
  }, Boolean(editor));
  const mediaUrlFor = (id: string) => mediaUrls?.get(id) ?? document.media.find((media) => media.id === id)?.url;
  const mediaFor = (id: string) => document.media.find((media) => media.id === id);
  const pageBackground = document.theme.backgroundMediaId ? mediaUrlFor(document.theme.backgroundMediaId) : undefined;
  return (
    <Box
      onClickCapture={editor ? (event) => {
        const target = event.target as HTMLElement;
        const block = target.closest<HTMLElement>('[data-editor-block-id]');
        const isAction = target.closest('.public-page-block-actions, .public-page-section-actions');
        if (block && !isAction && target.closest('a, button, [role="link"]')) {
          event.preventDefault();
          event.stopPropagation();
          editor.onSelectBlock(block.dataset.editorSectionId!, block.dataset.editorBlockId!);
        }
      } : undefined}
      sx={{
        ...resolvePublicPageThemeVariables(document.theme),
        bgcolor: 'var(--page-background)',
        backgroundImage: pageBackground ? `url("${pageBackground}")` : backgroundPresetCss(document.theme.backgroundPreset),
        backgroundSize: document.theme.backgroundFit,
        backgroundPosition: document.theme.backgroundPosition,
        backgroundRepeat: pageBackground ? 'no-repeat' : undefined,
        backgroundAttachment: 'fixed',
        color: 'var(--page-text)',
        fontFamily: document.theme.fontFamily,
        '& a:not([data-social-button]), & a.MuiButtonBase-root:not([data-social-button])': {
          ...ordinaryPublicPageLinkSx,
        },
        borderRadius: editor ? '22px' : 0,
        '& h1': { fontFamily: 'var(--theme-h1-font-family)', fontSize: 'var(--theme-h1-fontsize)', fontWeight: 'var(--theme-h1-font-weight)', lineHeight: 'var(--theme-h1-lineheight)', letterSpacing: 'var(--theme-h1-letterspacing)', color: 'var(--theme-heading-color)' },
        minHeight: '100%',
        display: editor ? 'flex' : undefined,
        flexDirection: editor ? 'column' : undefined,
        overflowX: editor ? 'visible' : 'clip',
        overflowWrap: 'anywhere',
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          display: editor ? 'flex' : 'grid',
          flexDirection: editor ? 'column' : undefined,
          gap: 'var(--theme-link-offset)',
          py: { xs: 3, md: 6 },
          px: editor ? '14px' : { xs: 2, sm: 3 },
          minHeight: editor ? '100%' : undefined,
          flex: editor ? '1 0 auto' : undefined,
          boxSizing: editor ? 'border-box' : undefined,
        }}
      >
        {(document.profile.logoMediaId || document.profile.avatarMediaId) ? (
          <PublicPageStyleBoundary>
            <Box component="header" sx={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 1.5, minWidth: 0, width: '100%', maxWidth: 320, mx: 'auto' }}>
              {document.profile.logoMediaId ? <Box component="img" src={mediaUrlFor(document.profile.logoMediaId)}
                alt={mediaFor(document.profile.logoMediaId)?.alt ?? ''}
                sx={{ maxWidth: 180, maxHeight: 64, objectFit: 'contain' }} /> : null}
              {document.profile.avatarMediaId ? <Box component="img" src={mediaUrlFor(document.profile.avatarMediaId)}
                alt={mediaFor(document.profile.avatarMediaId)?.alt || document.profile.displayName}
                sx={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', objectPosition: document.profile.avatarPosition }} /> : null}
            </Box>
          </PublicPageStyleBoundary>
        ) : null}
        {editor ? <Box ref={mainContainerRef} className="public-page-dnd-main-container" data-public-page-main-container data-public-page-dnd-context="page">
            {document.sections.map((section, sectionIndex) => (
              <Box key={section.id}
                className={`${SMOOTH_DND_WRAPPER_CLASS} public-page-dnd-wrapper public-page-dnd-section-wrapper`}
                data-public-page-sortable="section" data-section-id={section.id} data-public-page-dnd-context="page">
                <Box className="public-page-dnd-section-shell">
                  {editor.renderSectionDragHandle?.(section, sectionIndex, {})}
                  <SectionRenderer section={section} sectionIndex={sectionIndex} mediaUrlFor={mediaUrlFor} theme={document.theme}
                    services={services} publicPageSlug={document.slug} timezone={document.timezone} now={now} editor={editor} />
                </Box>
              </Box>
            ))}
          </Box> : document.sections.map((section, sectionIndex) => <SectionRenderer key={section.id} section={section} sectionIndex={sectionIndex}
            mediaUrlFor={mediaUrlFor} theme={document.theme} services={services} publicPageSlug={document.slug} timezone={document.timezone} now={now} />)}
      </Container>
    </Box>
  );
}

export function PublicPageRenderer(props: PublicPageRendererProps) {
  return <PublicPageRendererContent {...props} />;
}
