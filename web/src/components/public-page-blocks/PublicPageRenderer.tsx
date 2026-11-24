import { Box, Chip, Container } from '@mui/material';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isBlockScheduledVisible, nextScheduleVisibilityChange } from '../../features/public-page-builder/model/schedule';
import type {
  PageSection,
  PageBlock,
  PublicPageDocument,
  ItemSize,
  PageWidth,
} from '../../features/public-page-builder/types/publicPage';
import { LocaleScope } from '../../shared/i18n/I18nContext';
import { BlockRenderer, sectionSurfaceRadius } from './BlockRenderer';
import { StickyBookButton } from './StickyBookButton';
import { backgroundPresetCss } from '../../features/public-page-builder/config/backgroundPresets';
import {
  BuilderDndProvider,
  useBuilderDraggable,
  useBuilderDroppable,
  useDropIndicator,
  type BuilderDragPayload,
  type BuilderDropDestination,
  type BuilderDropTarget,
  type SortableActivator,
} from '../public-page-builder/BuilderDnd';
import { resolvePublicPageThemeVariables } from './publicPageThemeVariables';
import { resolveLeadingAvatarSectionMarginTop } from './avatarPresentation';
import { ordinaryPublicPageLinkSx } from './blocks';
import '../public-page-builder/publicPageDnd.css';
import type { PublicBookingService, PublicReviewsData } from '../../shared/types/api';
import { PublicPageStyleBoundary } from './PublicPageStyleBoundary';

const PAGE_WIDTH_PX: Record<PageWidth, number> = { narrow: 720, medium: 960, wide: 1200 };
/** Half-width items sit side by side once their container is at least this wide; below it everything is full width. */
const FLOW_TWO_COLUMN_QUERY = '@container (min-width: 600px)';
const flowGridSx = { display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 'var(--theme-link-offset)', minWidth: 0 } as const;
const flowItemSx = (size: ItemSize) => ({
  gridColumn: 'span 12',
  [FLOW_TWO_COLUMN_QUERY]: { gridColumn: size === 'half' ? 'span 6' : 'span 12' },
  minWidth: 0,
});
const SECTION_HORIZONTAL_SPACING_PX = 26;
/** Golden-ratio spacing scale (base 16px, step x1.618): 10 / 16 / 26 / 42 / 68. */
const PAGE_SPACE_VARIABLES = {
  '--page-space-1': '0.625rem', '--page-space-2': '1rem', '--page-space-3': '1.625rem', '--page-space-4': '2.625rem', '--page-space-5': '4.25rem',
} as const;
/** Extra space a new section needs on top of the regular block gap, so groups read as groups. */
const SECTION_START_SPACE = 'max(0px, calc(var(--page-space-4) - var(--theme-link-offset)))';
/** A lone heading belongs to what follows it, so it sits closer to it than the regular block gap. */
const isHeadingOnlyBlock = (block: PageSection['blocks'][number]) => {
  const paragraphs = (block.content.document as { paragraphs?: Array<{ size?: string }> } | undefined)?.paragraphs;
  return block.type === 'text' && Array.isArray(paragraphs) && paragraphs.length === 1 && ['h1', 'h2', 'h3'].includes(paragraphs[0]?.size ?? '');
};

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
function DropIndicatorBar({ target }: { target: BuilderDropTarget }) {
  const indicator = useDropIndicator(target);
  return indicator ? <Box aria-hidden className="public-page-drop-indicator" data-axis={indicator.axis} data-side={indicator.side} /> : null;
}

type EditorItemProps = { editor: PublicPageEditorRenderProps; children: ReactNode; sx: Record<string, unknown> };

type DndShellProps = {
  nodeRef: (node: HTMLElement | null) => void;
  className: string;
  attributes: Record<string, string>;
  sx: Record<string, unknown>;
  dragging: boolean;
  handle: ReactNode;
  target: BuilderDropTarget;
  children: ReactNode;
};

/**
 * The visible shell of a draggable item. It is memoized: while something is dragged, every draggable's hook
 * re-renders, but the shell (styles, content, handle) keeps identical props and is skipped, which keeps dragging smooth.
 */
const DndShell = memo(function DndShell({ nodeRef, className, attributes, sx, dragging, handle, target, children }: DndShellProps) {
  return <Box ref={nodeRef} className={className} {...attributes} sx={{ position: 'relative', opacity: dragging ? 0.4 : 1, ...sx }}>
    {children}
    {handle}
    <DropIndicatorBar target={target} />
  </Box>;
});

function EditorBlockItem({ section, block, blockIndex, editor, children, sx }: EditorItemProps & { section: PageSection; block: PageBlock; blockIndex: number }) {
  const target = useMemo<BuilderDropTarget>(() => ({ type: 'block', sectionId: section.id, blockId: block.id }), [section.id, block.id]);
  const payload = useMemo<BuilderDragPayload>(() => ({ type: 'block', blockId: block.id, sourceSectionId: section.id }), [block.id, section.id]);
  const drag = useBuilderDraggable(payload, block.name);
  const setDropRef = useBuilderDroppable(target);
  const { setNodeRef: setDragRef } = drag;
  const nodeRef = useCallback((node: HTMLElement | null) => { setDragRef(node); setDropRef(node); }, [setDragRef, setDropRef]);
  const handle = useMemo(() => editor.renderBlockDragHandle?.(section, blockIndex, drag.activator) ?? null, [editor, section, blockIndex, drag.activator]);
  const context = section.design.variant === 'off' ? 'page' : 'section';
  const attributes = useMemo(() => ({ 'data-public-page-sortable': 'block', 'data-block-id': block.id, 'data-public-page-dnd-context': context }), [block.id, context]);
  return <DndShell nodeRef={nodeRef} className="public-page-dnd-wrapper public-page-dnd-block-shell" attributes={attributes}
    sx={sx} dragging={drag.isDragging} handle={handle} target={target}>{children}</DndShell>;
}

function EditorSectionItem({ section, sectionIndex, editor, children }: Omit<EditorItemProps, 'sx'> & { section: PageSection; sectionIndex: number }) {
  const target = useMemo<BuilderDropTarget>(() => ({ type: 'section', sectionId: section.id }), [section.id]);
  const payload = useMemo<BuilderDragPayload>(() => ({ type: 'section', sectionId: section.id }), [section.id]);
  const drag = useBuilderDraggable(payload, section.name);
  const setDropRef = useBuilderDroppable(target);
  const { setNodeRef: setDragRef } = drag;
  const nodeRef = useCallback((node: HTMLElement | null) => { setDragRef(node); setDropRef(node); }, [setDragRef, setDropRef]);
  const handle = useMemo(() => editor.renderSectionDragHandle?.(section, sectionIndex, drag.activator) ?? null, [editor, section, sectionIndex, drag.activator]);
  const attributes = useMemo(() => ({ 'data-public-page-sortable': 'section', 'data-section-id': section.id, 'data-public-page-dnd-context': 'page' }), [section.id]);
  const sx = useMemo(() => (section.design.variant === 'off' ? { display: 'contents' } : flowItemSx(section.size)), [section.design.variant, section.size]);
  return <DndShell nodeRef={nodeRef} className="public-page-dnd-wrapper public-page-dnd-section-shell" attributes={attributes}
    sx={sx} dragging={drag.isDragging} handle={handle} target={target}>{children}</DndShell>;
}

function SectionRenderer({ section, sectionIndex, mediaUrlFor, theme, services, reviews, publicPageSlug, timezone, now, editor }: { section: PageSection; sectionIndex: number; mediaUrlFor: (id: string) => string | undefined; theme: PublicPageDocument['theme']; services: readonly PublicBookingService[]; reviews: PublicReviewsData | null; publicPageSlug: string; timezone: string; now: number; editor?: PublicPageEditorRenderProps }) {
  const serviceIds = new Set(services.map(({ id }) => id));
  const isRenderableBlock = (block: PageBlock) => {
    if (!block.visible) {return false;}
    if (!isBlockScheduledVisible(block.schedule, timezone, now)) {return false;}
    if (block.type === 'reviews') {return Boolean(reviews && reviews.reviews.length > 0);}
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
    ...PAGE_SPACE_VARIABLES,
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
    data-block-type={block.type}
    data-track-block-id={editor ? undefined : block.id}
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
      ...(editor ? {} : flowItemSx(block.size)),
      mt: editor ? 0 : `${resolveLeadingAvatarSectionMarginTop(block.type, blockIndex, section.design.paddingTop, isOff, block.content.layout)}px`,
      ...(isHeadingOnlyBlock(block) ? { mb: 'calc(var(--page-space-1) - var(--theme-link-offset))' } : {}),
      ...(!editor ? { '--avatar-leading-section-radius': leadingAvatarSectionRadius(block, blockIndex) } : {}),
      '&:hover .public-page-block-actions, &:has(:focus-visible) .public-page-block-actions': { opacity: 1, pointerEvents: 'auto' },
    }}
  >
    {editor?.scheduleStatusLabel && (block.schedule.period || block.schedule.weekdays) ? <Chip size="small" sx={{ mb: 0.5 }} label={editor.scheduleStatusLabel(isBlockScheduledVisible(block.schedule, timezone, now))} /> : null}
    <PublicPageStyleBoundary>
      <BlockRenderer block={block} mediaUrlFor={mediaUrlFor} editor={Boolean(editor)} themeBorderRadius={theme.styleDefaults.blockBorderRadius}
        roundingStyle={theme.roundingStyle} services={services} reviews={reviews} publicPageSlug={publicPageSlug} />
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
        mt: !isOff && sectionIndex > 0 ? SECTION_START_SPACE : undefined,
        ml: section.design.width === 'contained' ? 'auto' : sectionInlineMargin,
        mr: section.design.width === 'contained' ? 'auto' : sectionInlineMargin,
        '@media (max-width: 600px)': section.design.mobileVisible ? undefined : editor ? { opacity: 0.4 } : { display: 'none' },
        ...(isOff
          ? { display: 'contents' }
          : editor
            ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--theme-link-offset)', containerType: 'inline-size' }
            : { ...flowGridSx, ...flowItemSx(section.size), containerType: 'inline-size' }),
        minHeight: editor ? 52 : undefined,
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
      {isOff && sectionIndex > 0 ? <Box aria-hidden="true" sx={{ gridColumn: '1 / -1', height: 'max(0px, calc(var(--page-space-4) - 2 * var(--theme-link-offset)))', minHeight: 0 }} /> : null}
      {editor && !isOff ? editor.renderSectionActions(section, sectionIndex) : null}
      {editor ? <Box className="public-page-dnd-block-container" data-public-page-block-container={section.id}
        data-public-page-dnd-context={isOff ? 'page' : 'section'}
        sx={{
          ...(isOff ? { display: 'contents' } : flowGridSx),
          pt: isOff ? 0 : `${section.design.paddingTop}px`,
          pb: isOff ? 0 : `${section.design.paddingBottom}px`,
          pl: isOff ? 0 : `calc(${SECTION_HORIZONTAL_SPACING_PX}px + ${borderWidth}px)`,
          pr: isOff ? 0 : `calc(${SECTION_HORIZONTAL_SPACING_PX}px + ${borderWidth}px)`,
        }}>
        {section.blocks.map((block, blockIndex) => <EditorBlockItem key={block.id} section={section} block={block} blockIndex={blockIndex} editor={editor}
          sx={{
            ...flowItemSx(block.size),
            mt: `${resolveLeadingAvatarSectionMarginTop(block.type, blockIndex, section.design.paddingTop, isOff, block.content.layout)}px`,
            ...blockThemeSx,
            '--avatar-leading-section-radius': leadingAvatarSectionRadius(block, blockIndex),
          }}>
          {renderBlock(block, blockIndex)}
        </EditorBlockItem>)}
      </Box> : section.blocks.map((block, blockIndex) => ({ block, blockIndex })).filter(({ block }) => isRenderableBlock(block))
        .map(({ block, blockIndex }) => renderBlock(block, blockIndex))}
      {editor && !isOff && section.blocks.length > 0 ? editor.renderSectionResizeHandle?.(section, sectionIndex) : null}
    </Box>
  );
}

type PublicPageRendererProps = { document: PublicPageDocument; mediaUrls?: ReadonlyMap<string, string>; services?: readonly PublicBookingService[]; reviews?: PublicReviewsData | null; editor?: PublicPageEditorRenderProps };

function PublicPageRendererContent({ document, mediaUrls, services = [], reviews = null, editor }: PublicPageRendererProps) {
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
  const mediaUrlFor = (id: string) => mediaUrls?.get(id) ?? document.media.find((media) => media.id === id)?.url;
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
        ...PAGE_SPACE_VARIABLES,
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
        minHeight: editor ? '100%' : '100dvh',
        display: editor ? 'flex' : undefined,
        flexDirection: editor ? 'column' : undefined,
        overflowX: editor ? 'visible' : 'clip',
        overflowWrap: 'anywhere',
      }}
    >
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--theme-link-offset)',
          py: { xs: 'var(--page-space-3)', md: 'var(--page-space-4)' },
          px: editor ? 'var(--page-space-4)' : { xs: 'var(--page-space-2)', sm: 'var(--page-space-3)' },
          minHeight: editor ? '100%' : undefined,
          flex: editor ? '1 0 auto' : undefined,
          boxSizing: 'border-box',
          maxWidth: `${PAGE_WIDTH_PX[document.theme.pageWidth]}px`,
          containerType: 'inline-size',
        }}
      >
        <Box className="public-page-flow" data-public-page-main-container={editor ? '' : undefined} sx={flowGridSx}>
          {editor
            ? <BuilderDndProvider layout={document.sections.map((section) => ({ sectionId: section.id, blockIds: section.blocks.map((block) => block.id) }))}
              onDrop={editor.onDropItem}>
              {document.sections.map((section, sectionIndex) => (
                <EditorSectionItem key={section.id} section={section} sectionIndex={sectionIndex} editor={editor}>
                  <SectionRenderer section={section} sectionIndex={sectionIndex} mediaUrlFor={mediaUrlFor} theme={document.theme}
                    services={services} reviews={reviews} publicPageSlug={document.slug} timezone={document.timezone} now={now} editor={editor} />
                </EditorSectionItem>
              ))}
            </BuilderDndProvider>
            : document.sections.map((section, sectionIndex) => <SectionRenderer key={section.id} section={section} sectionIndex={sectionIndex}
              mediaUrlFor={mediaUrlFor} theme={document.theme} services={services} reviews={reviews} publicPageSlug={document.slug} timezone={document.timezone} now={now} />)}
        </Box>
      </Container>
      {editor || services.length === 0 ? null : <StickyBookButton />}
    </Box>
  );
}

export function PublicPageRenderer(props: PublicPageRendererProps) {
  return <LocaleScope locale={props.document.locale}><PublicPageRendererContent {...props} /></LocaleScope>;
}
