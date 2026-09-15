import { Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { BlockRenderer } from '../public-page-blocks/BlockRenderer';
import { resolvePublicPageThemeVariables } from '../public-page-blocks/publicPageThemeVariables';
import { PublicPageStyleBoundary } from '../public-page-blocks/PublicPageStyleBoundary';
import type { LinkStyle, PageBlock, PageSection, PageTheme } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { CompactTypographyControls } from './SectionDesignControls';
import { publicPageText } from './uiText';

const inheritedTypography = () => ({ fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null });
const inheritedLink = (): LinkStyle => ({ titleStyle: inheritedTypography(), subtitleStyle: inheritedTypography(), backgroundColor: null, backgroundOpacity: null, borderWidth: null, borderColor: null, shadow: null });

export function ButtonDesignControls({ block, theme, section, locale, onChange }: {
  block: PageBlock; theme: PageTheme; section?: PageSection; locale: Locale; onChange: (block: PageBlock) => void;
}) {
  const [previewRun, setPreviewRun] = useState(0);
  const link = block.design.linkStyle;
  const sectionLink = section?.design.variant !== 'off' ? section?.design.linkStyle : undefined;
  const defaults = theme.styleDefaults.linkStyle;
  const variables = resolvePublicPageThemeVariables(theme, section);
  const resolved = { ...defaults,
    titleStyle: { ...defaults.titleStyle, ...Object.fromEntries(Object.entries(sectionLink?.titleStyle ?? {}).filter(([, value]) => value !== null)), color: String(variables['--theme-link-title-color']) },
    subtitleStyle: { ...defaults.subtitleStyle, ...Object.fromEntries(Object.entries(sectionLink?.subtitleStyle ?? {}).filter(([, value]) => value !== null)), color: String(variables['--theme-link-subtitle-color']) },
  };
  const update = (changes: Partial<PageBlock['design']>) => onChange({ ...block, design: { ...block.design, ...changes } });
  const updateLink = (changes: Partial<LinkStyle>) => update({ linkStyle: { ...(link ?? inheritedLink()), ...changes } });
  return <Stack spacing={2}>
    <FormControlLabel label={publicPageText(locale, 'customButtonDesign')} control={<Switch checked={link !== null}
      onChange={(_, checked) => update({ linkStyle: checked ? inheritedLink() : null, ...(!checked ? { borderRadius: null } : {}) })} />} />
    <Typography color="text.secondary" variant="body2">{publicPageText(locale, link ? 'customValues' : 'buttonInheritance')}</Typography>
    {link ? <>
      <CompactTypographyControls locale={locale} label={publicPageText(locale, 'titleStyle')} value={link.titleStyle} resolvedValue={resolved.titleStyle} onChange={(titleStyle) => updateLink({ titleStyle })} />
      <CompactTypographyControls locale={locale} label={publicPageText(locale, 'subtitleStyle')} value={link.subtitleStyle} resolvedValue={resolved.subtitleStyle} onChange={(subtitleStyle) => updateLink({ subtitleStyle })} />
      <ColorControl label={publicPageText(locale, 'background')} value={link.backgroundColor} resolvedValue={String(variables['--theme-link-background'])} onChange={(backgroundColor) => updateLink({ backgroundColor })} />
      <TextField type="number" label={`${publicPageText(locale, 'backgroundOpacity')} (%)`} value={Math.round((link.backgroundOpacity ?? sectionLink?.backgroundOpacity ?? defaults.backgroundOpacity) * 100)} slotProps={{ htmlInput: { min: 0, max: 100 } }} onChange={(event) => updateLink({ backgroundOpacity: Math.max(0, Math.min(100, Number(event.target.value))) / 100 })} />
      <TextField type="number" label={publicPageText(locale, 'borderWidth')} value={link.borderWidth ?? sectionLink?.borderWidth ?? defaults.borderWidth} slotProps={{ htmlInput: { min: 0, max: 16 } }} onChange={(event) => updateLink({ borderWidth: Math.max(0, Math.min(16, Number(event.target.value))) })} />
      <ColorControl label={publicPageText(locale, 'borderColor')} value={link.borderColor} resolvedValue={String(variables['--theme-link-border-color'])} onChange={(borderColor) => updateLink({ borderColor })} />
      <TextField type="number" label={publicPageText(locale, 'borderRadius')} value={block.design.borderRadius ?? theme.styleDefaults.blockBorderRadius} slotProps={{ htmlInput: { min: 0, max: 100 } }} onChange={(event) => update({ borderRadius: Math.max(0, Math.min(100, Number(event.target.value))) })} />
      <TextField select label={publicPageText(locale, 'shadow')} value={link.shadow === null ? '' : String(link.shadow)} onChange={(event) => updateLink({ shadow: event.target.value === '' ? null : event.target.value === 'true' })}>
        <MenuItem value="">{publicPageText(locale, 'inherit')}</MenuItem><MenuItem value="false">{publicPageText(locale, 'none')}</MenuItem><MenuItem value="true">{publicPageText(locale, 'softShadow')}</MenuItem>
      </TextField>
      <Button onClick={() => update({ linkStyle: null, borderRadius: null })}>{publicPageText(locale, 'resetButtonDesign')}</Button>
    </> : null}
    <TextField select label={publicPageText(locale, 'animation')} value={block.design.animation} onChange={(event) => update({ animation: event.target.value as PageBlock['design']['animation'] })}>
      {(['none', 'pulse', 'lift'] as const).map((value) => <MenuItem key={value} value={value}>{publicPageText(locale, value)}</MenuItem>)}
    </TextField>
    <Typography variant="caption" color="text.secondary">{publicPageText(locale, 'reducedMotionHint')}</Typography>
    <Button onClick={() => setPreviewRun((value) => value + 1)}>{publicPageText(locale, 'preview')}</Button>
    <Box style={resolvePublicPageThemeVariables(theme, section)} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
      onClickCapture={(event) => {event.preventDefault(); event.stopPropagation();}}>
      <PublicPageStyleBoundary><BlockRenderer key={previewRun} block={block} editor themeBorderRadius={theme.styleDefaults.blockBorderRadius} roundingStyle={theme.roundingStyle} /></PublicPageStyleBoundary>
    </Box>
  </Stack>;
}
