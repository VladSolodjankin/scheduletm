import ExpandMore from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type Dispatch, type SyntheticEvent } from 'react';
import {
  applyPublicPageLinkStyle,
  applyPublicPagePalette,
  applyPublicPageThemeFont,
  applyPublicPageThemeRounding,
  PUBLIC_PAGE_THEMES,
} from '../../features/public-page-builder/config/themes';
import { PUBLIC_PAGE_BACKGROUND_PRESETS } from '../../features/public-page-builder/config/backgroundPresets';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import type { MediaReference, PageTheme } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ImageUploadControl } from './ImageUploadControl';
import { AdvancedDesignControls } from './AdvancedDesignControls';
import { publicPageText } from './uiText';

const fonts = [
  ['Inter', 'Inter, system-ui, sans-serif'], ['Roboto', 'Roboto, sans-serif'], ['Open Sans', '"Open Sans", sans-serif'],
  ['Montserrat', 'Montserrat, sans-serif'], ['Lato', 'Lato, sans-serif'],
] as const;

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
type SimpleDesignSection = 'colors' | 'fonts' | 'rounding' | 'links' | 'background';

const accordionSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: 'none',
  overflow: 'hidden',
  '&::before': { display: 'none' },
  '&.Mui-expanded': { m: 0 },
};

export function DesignPanel({ state, locale, dispatch, repository, previewUrls, onMediaPreview, busy = false, onBusyChange, focusMarker = null }: {
  state: EditorState; locale: Locale; dispatch: Dispatch<EditorAction>; repository: ApiPublicPageRepository;
  busy?: boolean; onBusyChange?: (busy: boolean) => void;
  focusMarker?: string | null;
  previewUrls: ReadonlyMap<string, string>; onMediaPreview: (media: MediaReference, objectUrl: string) => void;
}) {
  const theme = state.document.theme;
  const tabsId = useId();
  const backgroundFocusRequested = focusMarker === 'theme.backgroundMediaId' || focusMarker?.startsWith('media:') === true;
  const [activeTab, setActiveTab] = useState<DesignTab>('simple');
  const [simpleExpanded, setSimpleExpanded] = useState<SimpleDesignSection | false>(backgroundFocusRequested ? 'background' : 'colors');
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
  const uploadLabels = { uploadLabel: publicPageText(locale, 'uploadImage'), replaceLabel: publicPageText(locale, 'replaceImage'), removeLabel: publicPageText(locale, 'remove'),
    altLabel: publicPageText(locale, 'imageAlt'), invalidTypeText: publicPageText(locale, 'invalidImageType'), tooLargeText: publicPageText(locale, 'imageTooLarge'), uploadErrorText: publicPageText(locale, 'imageUploadError') };
  const backgroundMedia = state.document.media.find((media) => media.id === theme.backgroundMediaId) ?? null;
  const activeBackgroundPreset = theme.backgroundPreset ?? 'none';
  const toggleSimple = (section: SimpleDesignSection) => (_event: SyntheticEvent, expanded: boolean) => setSimpleExpanded(expanded ? section : false);
  return <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
    <Tabs value={activeTab} onChange={(_event, value: DesignTab) => setActiveTab(value)} aria-label={publicPageText(locale, 'designEditorMode')}
      variant="fullWidth" sx={{ mb: 2, minHeight: 40, bgcolor: 'action.hover', borderRadius: 2, p: 0.5,
        '& .MuiTab-root': { minHeight: 32, py: 0.5 }, '& .Mui-selected': { bgcolor: 'background.paper', borderRadius: 1.5, boxShadow: 1 },
        '& .MuiTabs-indicator': { display: 'none' } }}>
      <Tab id={`${tabsId}-simple-tab`} aria-controls={`${tabsId}-simple-panel`} value="simple" label={publicPageText(locale, 'simpleEditor')} />
      <Tab id={`${tabsId}-advanced-tab`} aria-controls={`${tabsId}-advanced-panel`} value="advanced" label={publicPageText(locale, 'advancedEditor')} />
    </Tabs>
    <Box role="tabpanel" id={`${tabsId}-simple-panel`} aria-labelledby={`${tabsId}-simple-tab`} hidden={activeTab !== 'simple'}>
      <Stack spacing={1}>
        <Accordion disableGutters expanded={simpleExpanded === 'colors'} onChange={toggleSimple('colors')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'colorPalettes')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {PUBLIC_PAGE_THEMES.map((palette) => <Box component="button" type="button" key={palette.id} aria-label={palette.name} aria-pressed={theme.id === palette.id} onClick={() => selectPalette(palette)} sx={cardSx(theme.id === palette.id)}>
          <Stack direction="row" spacing={-0.75}>{palette.swatches.map((color, index) => <Box key={`${color}-${index}`} sx={{ width: { xs: 24, xl: 30 }, height: { xs: 24, xl: 30 }, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />)}</Stack>
        </Box>)}
            </Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'fonts'} onChange={toggleSimple('fonts')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'fonts')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {fonts.map(([label, value]) => <Box component="button" type="button" key={label} aria-pressed={theme.fontFamily === value} onClick={() => update(applyPublicPageThemeFont(theme, value))}
          sx={{ ...cardSx(theme.fontFamily === value), fontFamily: value, flexDirection: 'column' }}><Typography sx={{ fontFamily: value, fontSize: 20 }}>{publicPageText(locale, 'fontPreview')}</Typography><Typography sx={{ fontFamily: value }}>{label}</Typography></Box>)}
            </Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'rounding'} onChange={toggleSimple('rounding')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'rounding')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>{roundings.map((item) => <Box component="button" type="button" aria-label={publicPageText(locale, item.id)} aria-pressed={theme.roundingStyle === item.id} key={item.id} onClick={() => update(applyPublicPageThemeRounding(theme, item.id))} sx={cardSx(theme.roundingStyle === item.id)}>
              <Box sx={{ width: 86, maxWidth: '100%', height: 36, bgcolor: 'text.secondary', borderRadius: item.radius }} /></Box>)}</Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'links'} onChange={toggleSimple('links')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'linkStyles')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>{linkStyles.map((item, index) => {
        const bg = item.surface ? theme.colors.surface : theme.colors.primary; const borderWidth = item.outline ? 1 : 0;
        const active = theme.linkStylePreset === item.id;
        return <Box component="button" type="button" aria-label={`${publicPageText(locale, 'linkStyle')} ${index + 1}`} aria-pressed={active} key={item.id} onClick={() => update(applyPublicPageLinkStyle(theme, item.id))} sx={cardSx(active)}>
          <Box sx={{ width: '75%', height: 34, bgcolor: bg, border: `${borderWidth}px solid ${theme.colors.primary}`, borderRadius: 1, boxShadow: item.shadow === 'strong' ? `0 4px 0 ${theme.colors.text}` : item.shadow ? 2 : 0 }} /></Box>;
            })}</Box>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters expanded={simpleExpanded === 'background'} onChange={toggleSimple('background')} sx={accordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'background')}</Typography></AccordionSummary>
          <AccordionDetails><Stack spacing={3}>
            <Box><Typography variant="subtitle2" sx={{ mb: 1.5 }}>{publicPageText(locale, 'backgroundPreset')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 1 }}>
        {PUBLIC_PAGE_BACKGROUND_PRESETS.map((preset) => {
          const active = activeBackgroundPreset === preset.id;
          const label = preset.id === 'none' ? publicPageText(locale, 'none') : preset.id;
          return <Box component="button" type="button" key={preset.id} aria-label={`${publicPageText(locale, 'backgroundPreset')}: ${label}`}
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
            <Box><Typography variant="subtitle2" sx={{ mb: 1.5 }}>{publicPageText(locale, 'backgroundImage')}</Typography>
              <ImageUploadControl compact disabled={busy} onBusyChange={onBusyChange} focusMarker="theme.backgroundMediaId"
                altFocusMarker={theme.backgroundMediaId ? `media:${theme.backgroundMediaId}:alt` : undefined}
                label={publicPageText(locale, 'pageBackground')} media={backgroundMedia} previewUrl={theme.backgroundMediaId ? previewUrls.get(theme.backgroundMediaId) : undefined} repository={repository} {...uploadLabels}
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
                <TextField select size="small" label={publicPageText(locale, 'imageFit')} value={theme.backgroundFit}
                  onChange={(event) => update({ ...theme, backgroundFit: event.target.value as 'cover' | 'contain' })}>
                  <MenuItem value="cover">{publicPageText(locale, 'imageFitCover')}</MenuItem>
                  <MenuItem value="contain">{publicPageText(locale, 'imageFitContain')}</MenuItem>
                </TextField>
                <TextField size="small" label={publicPageText(locale, 'focalPoint')} value={theme.backgroundPosition}
                  onChange={(event) => update({ ...theme, backgroundPosition: event.target.value })} />
              </Stack> : null}
            </Box>
          </Stack></AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
    <Box role="tabpanel" id={`${tabsId}-advanced-panel`} aria-labelledby={`${tabsId}-advanced-tab`} hidden={activeTab !== 'advanced'}>
      <AdvancedDesignControls theme={theme} locale={locale} onChange={update} />
    </Box>
  </Box>;
}
