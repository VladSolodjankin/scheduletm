import { Box, Stack, Typography } from '@mui/material';
import type { Dispatch } from 'react';
import { PUBLIC_PAGE_THEMES } from '../../features/public-page-builder/config/themes';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import type { MediaReference, PageTheme } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ImageUploadControl } from './ImageUploadControl';
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

export function DesignPanel({ state, locale, dispatch, repository, previewUrls, onMediaPreview }: {
  state: EditorState; locale: Locale; dispatch: Dispatch<EditorAction>; repository: ApiPublicPageRepository;
  previewUrls: ReadonlyMap<string, string>; onMediaPreview: (media: MediaReference, objectUrl: string) => void;
}) {
  const theme = state.document.theme;
  const update = (next: PageTheme) => dispatch({ type: 'theme/update', theme: next });
  const selectPalette = (palette: PageTheme) => {
    const surfaceLink = theme.linkStylePreset.startsWith('surface-');
    update({ ...theme, id: palette.id, name: palette.name, colors: palette.colors,
    styleDefaults: { ...theme.styleDefaults,
      headingStyle: { ...theme.styleDefaults.headingStyle, color: palette.colors.text },
      textStyle: { ...theme.styleDefaults.textStyle, color: palette.colors.text },
      linkStyle: { ...theme.styleDefaults.linkStyle,
        titleStyle: { ...theme.styleDefaults.linkStyle.titleStyle, color: surfaceLink ? palette.colors.text : palette.colors.background },
        subtitleStyle: { ...theme.styleDefaults.linkStyle.subtitleStyle, color: surfaceLink ? palette.colors.text : palette.colors.background },
        backgroundColor: surfaceLink ? palette.colors.surface : palette.colors.primary, borderColor: palette.colors.primary },
    } });
  };
  const cardSx = (active: boolean) => ({ minHeight: 72, p: 1.5, borderRadius: 2, border: '2px solid', borderColor: active ? 'primary.main' : 'divider',
    bgcolor: active ? 'action.selected' : 'background.paper', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  const uploadLabels = { uploadLabel: publicPageText(locale, 'uploadImage'), replaceLabel: publicPageText(locale, 'replaceImage'), removeLabel: publicPageText(locale, 'remove'),
    altLabel: publicPageText(locale, 'imageAlt'), invalidTypeText: publicPageText(locale, 'invalidImageType'), tooLargeText: publicPageText(locale, 'imageTooLarge'), uploadErrorText: publicPageText(locale, 'imageUploadError') };
  const backgroundMedia = state.document.media.find((media) => media.id === theme.backgroundMediaId) ?? null;
  return <Stack spacing={3}>
    <Box><Typography variant="h6" sx={{ mb: 1.5 }}>{publicPageText(locale, 'colorPalettes')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1 }}>
        {PUBLIC_PAGE_THEMES.map((palette) => <Box component="button" type="button" key={palette.id} aria-label={palette.name} onClick={() => selectPalette(palette)} sx={cardSx(theme.id === palette.id)}>
          <Stack direction="row" spacing={-0.5}>{Object.values(palette.colors).map((color) => <Box key={color} sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />)}</Stack>
        </Box>)}
      </Box>
    </Box>
    <Box><Typography variant="h6" sx={{ mb: 1.5 }}>{publicPageText(locale, 'fonts')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1 }}>
        {fonts.map(([label, value]) => <Box component="button" type="button" key={label} onClick={() => update({ ...theme, fontFamily: value, styleDefaults: { ...theme.styleDefaults,
          headingStyle: { ...theme.styleDefaults.headingStyle, fontFamily: value }, textStyle: { ...theme.styleDefaults.textStyle, fontFamily: value },
          linkStyle: { ...theme.styleDefaults.linkStyle, titleStyle: { ...theme.styleDefaults.linkStyle.titleStyle, fontFamily: value }, subtitleStyle: { ...theme.styleDefaults.linkStyle.subtitleStyle, fontFamily: value } } } })}
          sx={{ ...cardSx(theme.fontFamily === value), fontFamily: value, flexDirection: 'column' }}><Typography sx={{ fontFamily: value, fontSize: 20 }}>{publicPageText(locale, 'fontPreview')}</Typography><Typography sx={{ fontFamily: value }}>{label}</Typography></Box>)}
      </Box>
    </Box>
    <Box><Typography variant="h6" sx={{ mb: 1.5 }}>{publicPageText(locale, 'rounding')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>{roundings.map((item) => <Box component="button" type="button" aria-label={publicPageText(locale, item.id)} key={item.id} onClick={() => update({ ...theme, roundingStyle: item.id })} sx={cardSx(theme.roundingStyle === item.id)}>
        <Box sx={{ width: 86, height: 36, bgcolor: 'text.secondary', borderRadius: item.radius }} /></Box>)}</Box>
    </Box>
    <Box><Typography variant="h6" sx={{ mb: 1.5 }}>{publicPageText(locale, 'linkStyles')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>{linkStyles.map((item, index) => {
        const bg = item.surface ? theme.colors.surface : theme.colors.primary; const borderWidth = item.outline ? 1 : 0;
        const active = theme.linkStylePreset === item.id;
        return <Box component="button" type="button" aria-label={`${publicPageText(locale, 'linkStyle')} ${index + 1}`} key={item.id} onClick={() => update({ ...theme, linkStylePreset: item.id, styleDefaults: { ...theme.styleDefaults, linkStyle: { ...theme.styleDefaults.linkStyle,
          backgroundColor: bg, borderColor: theme.colors.primary, borderWidth, shadow: Boolean(item.shadow), titleStyle: { ...theme.styleDefaults.linkStyle.titleStyle, color: item.surface ? theme.colors.text : theme.colors.background }, subtitleStyle: { ...theme.styleDefaults.linkStyle.subtitleStyle, color: item.surface ? theme.colors.text : theme.colors.background } } } })} sx={cardSx(active)}>
          <Box sx={{ width: '75%', height: 34, bgcolor: bg, border: `${borderWidth}px solid ${theme.colors.primary}`, borderRadius: 1, boxShadow: item.shadow === 'strong' ? `0 4px 0 ${theme.colors.text}` : item.shadow ? 2 : 0 }} /></Box>;
      })}</Box>
    </Box>
    <Box><Typography variant="h6" sx={{ mb: 1.5 }}>{publicPageText(locale, 'backgroundImage')}</Typography>
      <ImageUploadControl label={publicPageText(locale, 'pageBackground')} media={backgroundMedia} previewUrl={theme.backgroundMediaId ? previewUrls.get(theme.backgroundMediaId) : undefined} repository={repository} {...uploadLabels}
        onAltChange={(media) => dispatch({ type: 'media/add', media })}
        onUploaded={(media, url) => { const previous = theme.backgroundMediaId; dispatch({ type: 'media/add', media }); onMediaPreview(media, url); update({ ...theme, backgroundMediaId: media.id }); if (previous) {dispatch({ type: 'media/remove', mediaId: previous });} }}
        onRemoved={() => { const previous = theme.backgroundMediaId; update({ ...theme, backgroundMediaId: null }); if (previous) {dispatch({ type: 'media/remove', mediaId: previous });} }} />
    </Box>
  </Stack>;
}
