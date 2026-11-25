import ExpandMore from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, FormControlLabel, MenuItem, Stack, Switch, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type Dispatch, type SyntheticEvent } from 'react';
import {
  applyPublicPageLinkStyle,
  applyPublicPageLinkLayout,
  applyPublicPageLinkTextAlign,
  applyPublicPagePalette,
  applyPublicPageThemeFont,
  applyPublicPageThemeRounding,
  PUBLIC_PAGE_THEME_CATEGORIES,
  PUBLIC_PAGE_THEME_CATEGORY,
  PUBLIC_PAGE_THEMES,
  type PublicPageThemeCategory,
} from '../../features/public-page-builder/config/themes';
import {
  PUBLIC_PAGE_BACKGROUND_CATEGORIES,
  PUBLIC_PAGE_BACKGROUND_PRESETS,
  type PublicPageBackgroundCategory,
} from '../../features/public-page-builder/config/backgroundPresets';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import type { MediaReference, PageTheme } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { PUBLIC_PAGE_BLOCK_GAPS, PUBLIC_PAGE_FONT_OPTIONS } from '../../features/public-page-builder/config/designOptions';
import { ImageUploadControl } from './ImageUploadControl';
import { PageSettingsPanel } from './PageSettingsPanel';
import type { SlugAvailabilityState } from '../../features/public-page-builder/model/slug';
import { AdvancedDesignControls } from './AdvancedDesignControls';
import { LinkLayoutControls, PageWidthControl } from './LayoutControls';
import { translate } from '../../shared/i18n/translate';

const fonts = PUBLIC_PAGE_FONT_OPTIONS;

const roundings: Array<{ id: PageTheme['roundingStyle']; radius: string }> = [
  { id: 'rounded', radius: '14px' }, { id: 'pill', radius: '999px' },
  { id: 'leaf', radius: '18px 4px 18px 4px' }, { id: 'square', radius: '2px' },
];

const linkStyles = [
  { id: 'primary-fill', surface: false, outline: false, shadow: false }, { id: 'primary-shadow', surface: false, outline: false, shadow: true },
  { id: 'primary-strong', surface: false, outline: false, shadow: 'strong' }, { id: 'primary-outline', surface: false, outline: true, shadow: false },
  { id: 'surface-fill', surface: true, outline: false, shadow: false }, { id: 'surface-outline', surface: true, outline: true, shadow: false },
  { id: 'surface-shadow', surface: true, outline: false, shadow: true }, { id: 'surface-strong', surface: true, outline: true, shadow: 'strong' },
] as const;

type DesignTab = 'simple' | 'advanced';
type SimpleDesignSection = 'colors' | 'fonts' | 'rounding' | 'links' | 'pageWidth' | 'spacing' | 'background' | 'page';

const accordionSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: 'none',
  overflow: 'hidden',
  '&::before': { display: 'none' },
  '&.Mui-expanded': { m: 0 },
};

function CategoryTabs<T extends string>({ value, categories, labels, onChange, ariaLabel }: {
  value: T; categories: readonly T[]; labels: Record<T, string>; onChange: (value: T) => void; ariaLabel: string;
}) {
  return <Tabs value={value} onChange={(_event, next: T) => onChange(next)} aria-label={ariaLabel} variant="scrollable" scrollButtons={false}
    sx={{ mb: 1.5, minHeight: 32,
      '& .MuiTab-root': { minHeight: 32, py: 0, px: 1.5, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 0 },
      '& .MuiTabs-indicator': { height: 2 } }}>
    {categories.map((category) => <Tab key={category} value={category} label={labels[category]} />)}
  </Tabs>;
}

export function DesignPanel({ state, locale, dispatch, repository, slugAvailability, previewUrls, onMediaPreview, busy = false, onBusyChange, focusMarker = null }: {
  state: EditorState; locale: Locale; dispatch: Dispatch<EditorAction>; repository: ApiPublicPageRepository; slugAvailability: SlugAvailabilityState;
  busy?: boolean; onBusyChange?: (busy: boolean) => void;
  focusMarker?: string | null;
  previewUrls: ReadonlyMap<string, string>; onMediaPreview: (media: MediaReference, objectUrl: string) => void;
}) {
  const theme = state.document.theme;
  const tabsId = useId();
  const backgroundFocusRequested = focusMarker === 'theme.backgroundMediaId' || focusMarker?.startsWith('media:') === true;
  const [activeTab, setActiveTab] = useState<DesignTab>('simple');
  const pageFocusRequested = focusMarker === 'slug' || focusMarker?.startsWith('seo.') === true;
  const [simpleExpanded, setSimpleExpanded] = useState<SimpleDesignSection | false>(backgroundFocusRequested ? 'background' : pageFocusRequested ? 'page' : 'colors');
  const [colorCategory, setColorCategory] = useState<PublicPageThemeCategory>('neutral');
  const [backgroundCategory, setBackgroundCategory] = useState<PublicPageBackgroundCategory>('neutral');
  const themeRef = useRef(theme);
  const mountedRef = useRef(true);
  const repositoryRef = useRef(repository);
  useEffect(() => {themeRef.current = theme;}, [theme]);
  useEffect(() => {repositoryRef.current = repository;}, [repository]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {mountedRef.current = false;};
  }, []);
  const update = (next: PageTheme) => dispatch({ type: 'theme/update', theme: next });
  const selectPalette = (palette: PageTheme) => update(applyPublicPagePalette(theme, palette));
  const cardSx = (active: boolean) => ({ minWidth: 0, minHeight: 82, p: { xs: 1, sm: 1.5 }, borderRadius: 2, border: '2px solid', borderColor: active ? 'primary.main' : 'divider',
    bgcolor: active ? 'action.selected' : 'background.paper', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } });
  const uploadLabels = { uploadLabel: translate(locale, 'publicPageBuilder.uploadImage'), replaceLabel: translate(locale, 'publicPageBuilder.replaceImage'), removeLabel: translate(locale, 'publicPageBuilder.remove'),
    altLabel: translate(locale, 'publicPageBuilder.imageAlt'), invalidTypeText: translate(locale, 'publicPageBuilder.invalidImageType'), tooLargeText: translate(locale, 'publicPageBuilder.imageTooLarge'), uploadErrorText: translate(locale, 'publicPageBuilder.imageUploadError') };
  const backgroundMedia = state.document.media.find((media) => media.id === theme.backgroundMediaId) ?? null;
  const activeBackgroundPreset = theme.backgroundPreset ?? 'none';
  const toggleSimple = (section: SimpleDesignSection) => (_event: SyntheticEvent, expanded: boolean) => setSimpleExpanded(expanded ? section : false);
  const categoryLabels = { neutral: translate(locale, 'publicPageBuilder.categoryNeutral'), bright: translate(locale, 'publicPageBuilder.categoryBright'), dark: translate(locale, 'publicPageBuilder.categoryDark') };
  const visiblePalettes = PUBLIC_PAGE_THEMES.filter((palette) => PUBLIC_PAGE_THEME_CATEGORY[palette.id] === colorCategory);
  const visibleBackgroundPresets = PUBLIC_PAGE_BACKGROUND_PRESETS.filter((preset) => preset.category === null || preset.category === backgroundCategory);
  return <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
    <Tabs value={activeTab} onChange={(_event, value: DesignTab) => setActiveTab(value)} aria-label={translate(locale, 'publicPageBuilder.designEditorMode')}
      variant="fullWidth" sx={{ mb: 2, minHeight: 40, bgcolor: 'action.hover', borderRadius: 2, p: 0.5,
        '& .MuiTab-root': { minHeight: 32, py: 0.5 }, '& .Mui-selected': { bgcolor: 'background.paper', borderRadius: 1.5, boxShadow: 1 },
        '& .MuiTabs-indicator': { display: 'none' } }}>
      <Tab id={`${tabsId}-simple-tab`} aria-controls={`${tabsId}-simple-panel`} value="simple" label={translate(locale, 'publicPageBuilder.simpleEditor')} />
      <Tab id={`${tabsId}-advanced-tab`} aria-controls={`${tabsId}-advanced-panel`} value="advanced" label={translate(locale, 'publicPageBuilder.advancedEditor')} />
    </Tabs>
    <Box role="tabpanel" id={`${tabsId}-simple-panel`} aria-labelledby={`${tabsId}-simple-tab`} hidden={activeTab !== 'simple'}>
      <Stack spacing={1}>
        <Accordion disableGutters expanded={simpleExpanded === 'colors'} onChange={toggleSimple('colors')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.colorPalettes')}</Typography></AccordionSummary>
          <AccordionDetails>
            <CategoryTabs value={colorCategory} categories={PUBLIC_PAGE_THEME_CATEGORIES} labels={categoryLabels} onChange={setColorCategory} ariaLabel={translate(locale, 'publicPageBuilder.colorPalettes')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {visiblePalettes.map((palette) => <Box component="button" type="button" key={palette.id} aria-label={palette.name} aria-pressed={theme.id === palette.id} onClick={() => selectPalette(palette)} sx={cardSx(theme.id === palette.id)}>
          <Stack direction="row" spacing={-0.75}>{palette.swatches.map((color, index) => <Box key={`${color}-${index}`} sx={{ width: { xs: 24, xl: 30 }, height: { xs: 24, xl: 30 }, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />)}</Stack>
        </Box>)}
            </Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'fonts'} onChange={toggleSimple('fonts')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.fonts')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {fonts.map(([label, value]) => <Box component="button" type="button" key={label} aria-pressed={theme.fontFamily === value} onClick={() => update(applyPublicPageThemeFont(theme, value))}
          sx={{ ...cardSx(theme.fontFamily === value), fontFamily: value, flexDirection: 'column' }}><Typography sx={{ fontFamily: value, fontSize: 20 }}>{translate(locale, 'publicPageBuilder.fontPreview')}</Typography><Typography sx={{ fontFamily: value }}>{label}</Typography></Box>)}
            </Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'rounding'} onChange={toggleSimple('rounding')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.rounding')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>{roundings.map((item) => <Box component="button" type="button" aria-label={translate(locale, `publicPageBuilder.${item.id}`)} aria-pressed={theme.roundingStyle === item.id} key={item.id} onClick={() => update(applyPublicPageThemeRounding(theme, item.id))} sx={cardSx(theme.roundingStyle === item.id)}>
              <Box sx={{ width: 86, maxWidth: '100%', height: 36, bgcolor: 'text.secondary', borderRadius: item.radius }} /></Box>)}</Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'links'} onChange={toggleSimple('links')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.linkStyles')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>{linkStyles.map((item, index) => {
        const bg = item.surface ? theme.colors.surface : theme.colors.primary; const borderWidth = item.outline ? 1 : 0;
        const active = theme.linkStylePreset === item.id;
        return <Box component="button" type="button" aria-label={`${translate(locale, 'publicPageBuilder.linkStyle')} ${index + 1}`} aria-pressed={active} key={item.id} onClick={() => update(applyPublicPageLinkStyle(theme, item.id))} sx={cardSx(active)}>
          <Box sx={{ width: '75%', height: 34, bgcolor: bg, border: `${borderWidth}px solid ${theme.colors.primary}`, borderRadius: 1, boxShadow: item.shadow === 'strong' ? `0 4px 0 ${theme.colors.text}` : item.shadow ? 2 : 0 }} /></Box>;
            })}</Box>
            <FormControlLabel sx={{ mt: 1.5, ml: 0 }} control={<Switch checked={theme.linkTextAlign === 'center'}
              onChange={(event) => update(applyPublicPageLinkTextAlign(theme, event.target.checked ? 'center' : 'left'))} />}
              label={translate(locale, 'publicPageBuilder.centeredText')} />
            <Box sx={{ mt: 1.5 }}>
              <LinkLayoutControls locale={locale} width={theme.styleDefaults.linkStyle.width} align={theme.styleDefaults.linkStyle.align}
                onWidthChange={(width) => width && update(applyPublicPageLinkLayout(theme, { width }))}
                onAlignChange={(align) => align && update(applyPublicPageLinkLayout(theme, { align }))} />
            </Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'pageWidth'} onChange={toggleSimple('pageWidth')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.pageWidth')}</Typography></AccordionSummary>
          <AccordionDetails>
            <PageWidthControl locale={locale} value={theme.pageWidth} onChange={(pageWidth) => update({ ...theme, pageWidth })} />
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'spacing'} onChange={toggleSimple('spacing')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.blockSpacing')}</Typography></AccordionSummary>
          <AccordionDetails>
            <ToggleButtonGroup exclusive fullWidth size="small" aria-label={translate(locale, 'publicPageBuilder.blockSpacing')} value={theme.tokens.layout.linkGap}
              onChange={(_event, next: number | null) => { if (next !== null) {update({ ...theme, tokens: { ...theme.tokens, layout: { ...theme.tokens.layout, linkGap: next } } });} }}>
              {PUBLIC_PAGE_BLOCK_GAPS.map((gap, index) => <ToggleButton key={gap} value={gap}>{translate(locale, `publicPageBuilder.${(['spacingCompact', 'spacingComfortable', 'spacingAiry'] as const)[index]}`)}</ToggleButton>)}
            </ToggleButtonGroup>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'background'} onChange={toggleSimple('background')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.background')}</Typography></AccordionSummary>
          <AccordionDetails><Stack spacing={3}>
            <Box><Typography variant="subtitle2" sx={{ mb: 1.5 }}>{translate(locale, 'publicPageBuilder.backgroundPreset')}</Typography>
              <CategoryTabs value={backgroundCategory} categories={PUBLIC_PAGE_BACKGROUND_CATEGORIES} labels={categoryLabels} onChange={setBackgroundCategory} ariaLabel={translate(locale, 'publicPageBuilder.backgroundPreset')} />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 1 }}>
        {visibleBackgroundPresets.map((preset) => {
          const active = activeBackgroundPreset === preset.id;
          const label = preset.id === 'none' ? translate(locale, 'publicPageBuilder.none') : preset.id;
          return <Box component="button" type="button" key={preset.id} aria-label={`${translate(locale, 'publicPageBuilder.backgroundPreset')}: ${label}`}
            aria-pressed={active} onClick={() => update({ ...theme, backgroundPreset: preset.id === 'none' ? null : preset.id })}
            sx={{ ...cardSx(active), minHeight: 64, p: 0.75 }}>
            <Box aria-hidden sx={{ width: '100%', height: 46, borderRadius: 1.5, border: '1px solid', borderColor: 'divider',
              bgcolor: preset.id === 'none' ? theme.colors.background : undefined,
              backgroundImage: preset.id === 'none'
                ? 'linear-gradient(135deg, transparent 47%, currentColor 48%, currentColor 52%, transparent 53%)'
                : preset.css }} />
          </Box>;
        })}
              </Box>
            </Box>
            <Box><Typography variant="subtitle2" sx={{ mb: 1.5 }}>{translate(locale, 'publicPageBuilder.backgroundImage')}</Typography>
              <ImageUploadControl compact disabled={busy} onBusyChange={onBusyChange} focusMarker="theme.backgroundMediaId"
                altFocusMarker={theme.backgroundMediaId ? `media:${theme.backgroundMediaId}:alt` : undefined}
                label={translate(locale, 'publicPageBuilder.pageBackground')} media={backgroundMedia} previewUrl={theme.backgroundMediaId ? previewUrls.get(theme.backgroundMediaId) : undefined} repository={repository} {...uploadLabels}
                onAltChange={(media) => dispatch({ type: 'media/add', media })}
                onUploaded={async (media, url) => {
                  if (!mountedRef.current) {
                    try {await repositoryRef.current.deleteMedia(media.id);}
                    finally {URL.revokeObjectURL(url);}
                    return;
                  }
                  const previous = themeRef.current.backgroundMediaId;
                  dispatch({ type: 'media/add', media }); onMediaPreview(media, url);
                  update({ ...themeRef.current, backgroundMediaId: media.id });
                  if (previous) {dispatch({ type: 'media/remove', mediaId: previous });}
                }}
                onRemoved={() => { const previous = theme.backgroundMediaId; update({ ...theme, backgroundMediaId: null }); if (previous) {dispatch({ type: 'media/remove', mediaId: previous });} }} />
              {theme.backgroundMediaId ? <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <TextField select size="small" label={translate(locale, 'publicPageBuilder.imageFit')} value={theme.backgroundFit}
                  onChange={(event) => update({ ...theme, backgroundFit: event.target.value as 'cover' | 'contain' })}>
                  <MenuItem value="cover">{translate(locale, 'publicPageBuilder.imageFitCover')}</MenuItem>
                  <MenuItem value="contain">{translate(locale, 'publicPageBuilder.imageFitContain')}</MenuItem>
                </TextField>
                <TextField size="small" label={translate(locale, 'publicPageBuilder.focalPoint')} value={theme.backgroundPosition}
                  onChange={(event) => update({ ...theme, backgroundPosition: event.target.value })} />
              </Stack> : null}
            </Box>
          </Stack></AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'page'} onChange={toggleSimple('page')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{translate(locale, 'publicPageBuilder.addressAndSearch')}</Typography></AccordionSummary>
          <AccordionDetails>
            <PageSettingsPanel state={state} locale={locale} dispatch={dispatch} repository={repository} slugAvailability={slugAvailability}
              previewUrls={previewUrls} onMediaPreview={onMediaPreview} busy={busy} onBusyChange={onBusyChange} />
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
    <Box role="tabpanel" id={`${tabsId}-advanced-panel`} aria-labelledby={`${tabsId}-advanced-tab`} hidden={activeTab !== 'advanced'}>
      <AdvancedDesignControls theme={theme} locale={locale} onChange={update} />
    </Box>
  </Box>;
}
