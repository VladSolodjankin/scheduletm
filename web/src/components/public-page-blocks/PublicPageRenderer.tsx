import { Box, Container, Typography } from '@mui/material';
import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type {
  PageSection,
  PageBlock,
  PublicPageDocument,
  SectionLayout,
} from '../../features/public-page-builder/types/publicPage';
import { BlockRenderer, sectionThemeRadius, themeRadius } from './BlockRenderer';
import { backgroundPresetCss } from '../../features/public-page-builder/config/backgroundPresets';
import {
  BLOCK_DRAG_HANDLE,
  PUBLIC_PAGE_DND_DRAG_CLASS,
  PUBLIC_PAGE_DND_GROUP,
  PUBLIC_PAGE_DND_SECTION_INSET,
  SECTION_DRAG_HANDLE,
  SMOOTH_DND_WRAPPER_CLASS,
  isBuilderDragPayload,
  useSmoothDndContainer,
  type BuilderDragPayload,
  type BuilderDropDestination,
  type SortableActivator,
} from '../public-page-builder/BuilderSortable';

const columnsByLayout: Record<SectionLayout, string> = {
  single: 'minmax(0, 1fr)',
  'two-equal': 'repeat(2, minmax(0, 1fr))',
  'one-third-two-thirds': 'minmax(0, 1fr) minmax(0, 2fr)',
  'two-thirds-one-third': 'minmax(0, 2fr) minmax(0, 1fr)',
  'three-equal': 'repeat(3, minmax(0, 1fr))',
  stack: 'minmax(0, 1fr)',
  'hero-overlay': 'minmax(0, 1fr)',
};

export type PublicPageEditorRenderProps = {
  selectedBlockId: string | null;
  onSelectBlock: (sectionId: string, blockId: string) => void;
  renderBlockActions: (section: PageSection, blockIndex: number) => ReactNode;
  renderSectionActions: (section: PageSection, sectionIndex: number) => ReactNode;
  blockAriaLabel: (blockName: string) => string;
  renderBlockDragHandle?: (section: PageSection, blockIndex: number, activator: SortableActivator) => ReactNode;
  renderSectionDragHandle?: (section: PageSection, sectionIndex: number, activator: SortableActivator) => ReactNode;
  stagedBlocks?: readonly PageBlock[];
  renderStagedBlockActions?: (block: PageBlock, blockIndex: number) => ReactNode;
  renderStagedBlockDragHandle?: (block: PageBlock, blockIndex: number, activator: SortableActivator) => ReactNode;
  onDropItem: (payload: BuilderDragPayload, destination: BuilderDropDestination) => void;
};
type MainRenderItem = { type: 'section'; id: string; section: PageSection }
  | { type: 'free-block'; id: string; section: PageSection; block: PageBlock; blockIndex: number };

function SectionRenderer({ section, sectionIndex, mediaUrlFor, theme, editor, ghostReferenceRef }: { section: PageSection; sectionIndex: number; mediaUrlFor: (id: string) => string | undefined; theme: PublicPageDocument['theme']; editor?: PublicPageEditorRenderProps; ghostReferenceRef: RefObject<HTMLElement | null> }) {
  const blockContainerRef = useRef<HTMLDivElement>(null);
  useSmoothDndContainer(blockContainerRef, {
    behaviour: 'move',
    groupName: PUBLIC_PAGE_DND_GROUP,
    orientation: 'vertical',
    dragHandleSelector: BLOCK_DRAG_HANDLE,
    animationDuration: 180,
    lockAxis: 'y',
    dragClass: PUBLIC_PAGE_DND_DRAG_CLASS,
    dropPlaceholder: { className: 'public-page-dnd-placeholder', animationDuration: 180, showOnTop: true },
    ghostReferenceRef,
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
  if (!editor && (!section.visible || section.blocks.length === 0)) {
    return null;
  }

  const backgroundUrl = section.design.backgroundMediaId ? mediaUrlFor(section.design.backgroundMediaId) : undefined;
  const isOff = section.design.variant === 'off';
  const borderWidth = isOff ? 0 : section.design.borderWidth ?? 0;
  const sectionInlineMargin = section.design.horizontalMargin ? '1rem' : '0px';
  const themeColors = theme.colors;
  const variantBackground = section.design.variant === 'primary' ? themeColors.primary : section.design.variant === 'secondary' ? themeColors.surface : 'transparent';
  const variantText = section.design.variant === 'primary' ? themeColors.background : section.design.variant === 'secondary' ? themeColors.text : 'inherit';
  const heading = isOff ? theme.styleDefaults.headingStyle : { ...theme.styleDefaults.headingStyle, ...Object.fromEntries(Object.entries(section.design.headingStyle).filter(([, value]) => value !== null)) };
  const text = isOff ? theme.styleDefaults.textStyle : { ...theme.styleDefaults.textStyle, ...Object.fromEntries(Object.entries(section.design.textStyle).filter(([, value]) => value !== null)) };
  const link = isOff ? theme.styleDefaults.linkStyle : section.design.linkStyle; const linkDefault = theme.styleDefaults.linkStyle;
  const linkBackgroundColor = link.backgroundColor ?? linkDefault.backgroundColor;
  const linkBackgroundOpacity = link.backgroundOpacity ?? linkDefault.backgroundOpacity;
  const linkTitle = { ...linkDefault.titleStyle, ...Object.fromEntries(Object.entries(link.titleStyle).filter(([, value]) => value !== null)) };
  const linkSubtitle = { ...linkDefault.subtitleStyle, ...Object.fromEntries(Object.entries(link.subtitleStyle).filter(([, value]) => value !== null)) };
  const renderBlock = (block: PageSection['blocks'][number], blockIndex: number) => <Box
    key={block.id}
    data-editor-block-id={editor ? block.id : undefined}
    data-editor-section-id={editor ? section.id : undefined}
    tabIndex={editor ? 0 : undefined}
    role={editor ? 'group' : undefined}
    aria-label={editor ? editor.blockAriaLabel(block.name) : undefined}
    onClick={editor ? () => editor.onSelectBlock(section.id, block.id) : undefined}
    onKeyDown={editor ? (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); editor.onSelectBlock(section.id, block.id); } } : undefined}
    sx={{
      position: 'relative', minWidth: 0,
      '&:hover .public-page-block-actions, &:focus-within .public-page-block-actions': { opacity: 1, pointerEvents: 'auto' },
    }}
  >
    <BlockRenderer block={block} mediaUrlFor={mediaUrlFor} editor={Boolean(editor)} themeBorderRadius={theme.styleDefaults.blockBorderRadius} roundingStyle={theme.roundingStyle} />
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
        color: isOff ? 'inherit' : section.design.textColor ?? variantText,
        pt: editor || isOff ? 0 : `${section.design.paddingTop}px`,
        pb: editor || isOff ? 0 : `${section.design.paddingBottom}px`,
        pl: editor || isOff ? 0 : `calc(1rem + ${borderWidth}px)`,
        pr: editor || isOff ? 0 : `calc(1rem + ${borderWidth}px)`,
        borderRadius: isOff
          ? 0
          : sectionThemeRadius(theme.roundingStyle, theme.styleDefaults.blockBorderRadius),
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
        gap: 'var(--theme-link-offset, 10px)',
        minHeight: editor ? 52 : undefined,
        minWidth: 0,
        '& > *': { minWidth: 0 },
        position: 'relative',
        '& h1, & h2, & h3, & h4, & h5, & h6': { fontFamily: heading.fontFamily, fontSize: `${heading.fontSize}px`, fontWeight: heading.fontWeight, fontStyle: heading.fontStyle, color: heading.color },
        '& p': { fontFamily: text.fontFamily, fontSize: `${text.fontSize}px`, fontWeight: text.fontWeight, fontStyle: text.fontStyle, color: text.color },
        '& a:not([data-social-button]), & a.MuiButtonBase-root:not([data-social-button])': { fontFamily: linkTitle.fontFamily, fontSize: `${linkTitle.fontSize}px`, fontWeight: linkTitle.fontWeight, fontStyle: linkTitle.fontStyle,
          color: linkTitle.color, backgroundColor: `color-mix(in srgb, ${linkBackgroundColor} ${linkBackgroundOpacity * 100}%, transparent)`,
          borderWidth: `${link.borderWidth ?? linkDefault.borderWidth}px`, borderStyle: 'solid', borderColor: link.borderColor ?? linkDefault.borderColor,
          boxShadow: (link.shadow ?? linkDefault.shadow)
            ? theme.linkStylePreset.endsWith('strong') ? `0 4px 0 ${theme.colors.text}` : 3
            : 'none', borderRadius: themeRadius(theme.roundingStyle, theme.styleDefaults.blockBorderRadius) },
        '& a:not([data-social-button]) .MuiTypography-root, & a:not([data-social-button]) small': { fontFamily: linkSubtitle.fontFamily, fontSize: `${linkSubtitle.fontSize}px`, fontWeight: linkSubtitle.fontWeight, fontStyle: linkSubtitle.fontStyle, color: linkSubtitle.color },
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
      {editor ? <Box ref={blockContainerRef} data-public-page-block-container={section.id}
        sx={{
          display: 'grid',
          gridColumn: '1 / -1',
          gap: 'var(--theme-link-offset, 10px)',
          minHeight: 52,
          alignContent: 'start',
          boxSizing: 'border-box',
          pt: isOff ? 0 : `${section.design.paddingTop}px`,
          pb: isOff ? 0 : `${section.design.paddingBottom}px`,
          pl: isOff ? 0 : `calc(1rem + ${borderWidth}px)`,
          pr: isOff ? 0 : `calc(1rem + ${borderWidth}px)`,
          [PUBLIC_PAGE_DND_SECTION_INSET]: `calc(${sectionInlineMargin} + 1rem + ${borderWidth * 2}px)`,
        }}>
        {section.blocks.map((block, blockIndex) => <Box key={block.id} className={SMOOTH_DND_WRAPPER_CLASS}
          data-public-page-sortable="block" data-block-id={block.id} style={{ overflow: 'visible' }}>
          <Box sx={{ position: 'relative', minWidth: 0 }}>
            {editor.renderBlockDragHandle?.(section, blockIndex, {})}
            {renderBlock(block, blockIndex)}
          </Box>
        </Box>)}
      </Box> : section.blocks.map(renderBlock)}
    </Box>
  );
}

type PublicPageRendererProps = { document: PublicPageDocument; mediaUrls?: ReadonlyMap<string, string>; editor?: PublicPageEditorRenderProps };

function PublicPageRendererContent({ document, mediaUrls, editor }: PublicPageRendererProps) {
  const mainItems = useMemo(() => document.sections.flatMap<MainRenderItem>((section) => section.design.variant === 'off'
    ? section.blocks.map((block, blockIndex) => ({ type: 'free-block' as const, id: `block:${block.id}`, section, block, blockIndex }))
    : [{ type: 'section' as const, id: `section:${section.id}`, section }]), [document.sections]);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const stagedContainerRef = useRef<HTMLDivElement>(null);
  useSmoothDndContainer(mainContainerRef, {
    behaviour: 'move', groupName: PUBLIC_PAGE_DND_GROUP, orientation: 'vertical',
    dragHandleSelector: `${BLOCK_DRAG_HANDLE}, ${SECTION_DRAG_HANDLE}`,
    animationDuration: 180, lockAxis: 'y', dragClass: PUBLIC_PAGE_DND_DRAG_CLASS,
    dropPlaceholder: { className: 'public-page-dnd-placeholder', animationDuration: 180, showOnTop: true },
    ghostReferenceRef: mainContainerRef,
    getChildPayload: (index) => {
      const child = mainContainerRef.current!.children[index] as HTMLElement;
      return child.dataset.publicPageSortable === 'section'
        ? { type: 'section', sectionId: child.dataset.sectionId! }
        : { type: 'block', blockId: child.dataset.blockId!, sourceSectionId: child.dataset.sourceSectionId! };
    },
    shouldAcceptDrop: (_source, payload) => isBuilderDragPayload(payload),
    onDrop: ({ addedIndex, payload }) => {
      if (addedIndex !== null && isBuilderDragPayload(payload)) {
        editor?.onDropItem(payload, { type: 'main', index: addedIndex });
      }
    },
  }, Boolean(editor));
  useSmoothDndContainer(stagedContainerRef, {
    behaviour: 'move', groupName: PUBLIC_PAGE_DND_GROUP, orientation: 'vertical',
    dragHandleSelector: BLOCK_DRAG_HANDLE, animationDuration: 180, lockAxis: 'y', dragClass: PUBLIC_PAGE_DND_DRAG_CLASS,
    ghostReferenceRef: mainContainerRef,
    getChildPayload: (index) => ({ type: 'staged', block: editor!.stagedBlocks![index] }),
    shouldAcceptDrop: (_source, payload) => isBuilderDragPayload(payload) && payload.type === 'staged',
    onDrop: () => undefined,
  }, Boolean(editor?.stagedBlocks?.length));
  const { colors } = document.theme;
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
        bgcolor: colors.background,
        backgroundImage: pageBackground ? `url("${pageBackground}")` : backgroundPresetCss(document.theme.backgroundPreset),
        backgroundSize: document.theme.backgroundFit,
        backgroundPosition: document.theme.backgroundPosition,
        backgroundAttachment: 'fixed',
        color: colors.text,
        fontFamily: document.theme.fontFamily,
        borderRadius: '24px',
        '--theme-link-border-radius': themeRadius(document.theme.roundingStyle, document.theme.styleDefaults.blockBorderRadius),
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
          gap: 'var(--theme-link-offset, 10px)',
          py: { xs: 3, md: 6 },
          px: { xs: 2, sm: 3 },
          minHeight: editor ? '100%' : undefined,
          flex: editor ? '1 0 auto' : undefined,
          boxSizing: editor ? 'border-box' : undefined,
        }}
      >
        {(document.profile.logoMediaId || document.profile.avatarMediaId || document.profile.displayName || document.profile.description) ? (
          <Box component="header" sx={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 1.5, minWidth: 0, width: '100%', maxWidth: 320, mx: 'auto' }}>
            {document.profile.logoMediaId ? <Box component="img" src={mediaUrlFor(document.profile.logoMediaId)}
              alt={mediaFor(document.profile.logoMediaId)?.alt ?? ''}
              sx={{ maxWidth: 180, maxHeight: 64, objectFit: 'contain' }} /> : null}
            {document.profile.avatarMediaId ? <Box component="img" src={mediaUrlFor(document.profile.avatarMediaId)}
              alt={mediaFor(document.profile.avatarMediaId)?.alt || document.profile.displayName}
              sx={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover' }} /> : null}
            {document.profile.displayName ? <Typography component="h1" variant="h4" sx={{ maxWidth: '100%', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{document.profile.displayName}</Typography> : null}
            {document.profile.description ? <Typography sx={{ maxWidth: '100%', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{document.profile.description}</Typography> : null}
          </Box>
        ) : null}
        {editor ? <Box ref={mainContainerRef} data-public-page-main-container
          sx={{ display: 'grid', gap: 'var(--theme-link-offset, 10px)', minHeight: 52, flex: '1 0 52px', alignContent: 'start', [PUBLIC_PAGE_DND_SECTION_INSET]: '0px' }}>
            {mainItems.map((item) => {
              const sectionIndex = document.sections.findIndex((section) => section.id === item.section.id);
              return item.type === 'section'
                ? <Box key={item.id} className={SMOOTH_DND_WRAPPER_CLASS} data-public-page-sortable="section"
                    data-section-id={item.section.id}
                    style={{ overflow: 'visible' }}
                    sx={{ minWidth: 0 }}>
                    <Box sx={{ position: 'relative', minWidth: 0,
                      '&:hover > .public-page-section-drag-rail, &:focus-within > .public-page-section-drag-rail, &:hover > [data-public-page-section-drag-target] > .public-page-section-resize-handle, &:focus-within > [data-public-page-section-drag-target] > .public-page-section-resize-handle': { opacity: 1, pointerEvents: 'auto' } }}>
                      {editor.renderSectionDragHandle?.(item.section, sectionIndex, {})}
                      <SectionRenderer section={item.section} sectionIndex={sectionIndex} mediaUrlFor={mediaUrlFor} theme={document.theme} editor={editor} ghostReferenceRef={mainContainerRef} />
                    </Box>
                  </Box>
                : <Box key={item.id} className={SMOOTH_DND_WRAPPER_CLASS} data-public-page-sortable="block"
                    data-block-id={item.block.id} data-source-section-id={item.section.id}
                    style={{ overflow: 'visible' }}
                    sx={{ minWidth: 0 }}>
                    <Box sx={{ position: 'relative', minWidth: 0 }}>
                      {editor.renderBlockDragHandle?.(item.section, item.blockIndex, {})}
                      <Box data-public-page-free-block data-editor-block-id={item.block.id} data-editor-section-id={item.section.id}
                        tabIndex={0} role="group" aria-label={editor.blockAriaLabel(item.block.name)}
                        onClick={() => editor.onSelectBlock(item.section.id, item.block.id)} sx={{ position: 'relative', minWidth: 0,
                          color: colors.text, fontFamily: document.theme.fontFamily,
                          '&:hover .public-page-block-actions, &:focus-within .public-page-block-actions': { opacity: 1, pointerEvents: 'auto' } }}>
                        <BlockRenderer block={item.block} mediaUrlFor={mediaUrlFor} editor themeBorderRadius={document.theme.styleDefaults.blockBorderRadius} roundingStyle={document.theme.roundingStyle} />
                        {editor.renderBlockActions(item.section, item.blockIndex)}
                      </Box>
                    </Box>
                  </Box>;
            })}
          </Box> : document.sections.map((section, sectionIndex) => <SectionRenderer key={section.id} section={section} sectionIndex={sectionIndex} mediaUrlFor={mediaUrlFor} theme={document.theme} ghostReferenceRef={mainContainerRef} />)}
        {editor?.stagedBlocks?.length ? <Box ref={stagedContainerRef} data-public-page-block-staging
          sx={{ display: 'grid', gap: 1.25, mt: 2, minWidth: 0, [PUBLIC_PAGE_DND_SECTION_INSET]: '0px' }}>
            {editor.stagedBlocks.map((block, blockIndex) => <Box key={block.id} className={SMOOTH_DND_WRAPPER_CLASS}
              data-public-page-sortable="staged-block" style={{ overflow: 'visible' }}>
              <Box sx={{ position: 'relative', minWidth: 0 }}>
                {editor.renderStagedBlockDragHandle?.(block, blockIndex, {})}
                <Box sx={{ position: 'relative', minWidth: 0 }}>
                  <BlockRenderer block={block} mediaUrlFor={mediaUrlFor} editor themeBorderRadius={document.theme.styleDefaults.blockBorderRadius} roundingStyle={document.theme.roundingStyle} />
                  {editor.renderStagedBlockActions?.(block, blockIndex)}
                </Box>
              </Box>
            </Box>)}
          </Box> : null}
      </Container>
    </Box>
  );
}

export function PublicPageRenderer(props: PublicPageRendererProps) {
  return <PublicPageRendererContent {...props} />;
}
