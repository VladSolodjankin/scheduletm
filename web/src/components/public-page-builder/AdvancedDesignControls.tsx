import ExpandMore from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState, type SyntheticEvent } from 'react';
import type { PageTheme, ResolvedTypographyStyle, TypographyStyle } from '../../features/public-page-builder/types/publicPage';
import { applyPublicPageThemeColors, resetPublicPageDesignGroup } from '../../features/public-page-builder/config/themes';
import type { Locale } from '../../shared/i18n/dictionaries';
import { CompactTypographyControls } from './SectionDesignControls';
import { ColorControl } from './ColorControl';
import { SettingsRow } from './SettingsRow';
import { publicPageText } from './uiText';

type AdvancedDesignSection = 'typography' | 'buttons' | 'background' | 'sections';

const accordionSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: 'none',
  overflow: 'hidden',
  '&::before': { display: 'none' },
  '&.Mui-expanded': { m: 0 },
};

export function AdvancedDesignControls({ theme, locale, onChange }: { theme: PageTheme; locale: Locale; onChange: (theme: PageTheme) => void }) {
  const [expanded, setExpanded] = useState<AdvancedDesignSection | false>('typography');
  const defaults = theme.styleDefaults;
  const resetTypography = resetPublicPageDesignGroup(theme, 'typography');
  const resetButtons = resetPublicPageDesignGroup(theme, 'buttons');
  const resetSections = resetPublicPageDesignGroup(theme, 'sections');
  const merge = (value: TypographyStyle, baseline: ResolvedTypographyStyle): ResolvedTypographyStyle => ({
    fontFamily: value.fontFamily ?? baseline.fontFamily, fontSize: value.fontSize ?? baseline.fontSize,
    fontWeight: value.fontWeight ?? baseline.fontWeight, fontStyle: value.fontStyle ?? baseline.fontStyle, color: value.color ?? baseline.color,
  });
  const updateTypography = (key: 'headingStyle' | 'textStyle', value: TypographyStyle) => {
    const style = merge(value, resetTypography.styleDefaults[key]);
    const typography = { ...theme.tokens.typography };
    const tokens = key === 'headingStyle' ? ['h1', 'h2', 'h3', 'avatarTitle'] as const : ['textLarge', 'textMedium', 'textSmall', 'avatarBio'] as const;
    for (const token of tokens) {typography[token] = { ...typography[token], fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight };}
    if (key === 'headingStyle') {typography.headingColor = style.color;}
    onChange({ ...theme, tokens: { ...theme.tokens, typography }, styleDefaults: { ...defaults, [key]: style } });
  };
  const updateButtonTypography = (key: 'titleStyle' | 'subtitleStyle', value: TypographyStyle) => {
    const style = merge(value, resetButtons.styleDefaults.linkStyle[key]);
    const token = key === 'titleStyle' ? 'linkTitle' : 'linkSubtitle';
    onChange({ ...theme, tokens: { ...theme.tokens, typography: { ...theme.tokens.typography,
      [token]: { ...theme.tokens.typography[token], fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight } } },
      styleDefaults: { ...defaults, linkStyle: { ...defaults.linkStyle, [key]: style } } });
  };
  const updateButtons = (changes: Partial<PageTheme['styleDefaults']['linkStyle']>) => onChange({ ...theme, styleDefaults: { ...defaults, linkStyle: { ...defaults.linkStyle, ...changes } } });
  const source = (same: boolean) => <Typography variant="caption" color="text.secondary">{publicPageText(locale, same ? 'fromPageTheme' : 'customValues')}</Typography>;
  const toggle = (section: AdvancedDesignSection) => (_event: SyntheticEvent, open: boolean) => setExpanded(open ? section : false);
  return <Stack spacing={1} data-public-page-advanced-design>
    <Typography variant="body2" color="text.secondary">{publicPageText(locale, 'palettePreserves')}</Typography>
    <Accordion disableGutters expanded={expanded === 'typography'} onChange={toggle('typography')} sx={accordionSx}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'typography')}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>
      <CompactTypographyControls locale={locale} label={publicPageText(locale, 'headingStyle')} value={defaults.headingStyle} resolvedValue={resetTypography.styleDefaults.headingStyle} onChange={(value) => updateTypography('headingStyle', value)} />
      <CompactTypographyControls locale={locale} label={publicPageText(locale, 'bodyStyle')} value={defaults.textStyle} resolvedValue={resetTypography.styleDefaults.textStyle} onChange={(value) => updateTypography('textStyle', value)} />
      {source(JSON.stringify([defaults.headingStyle, defaults.textStyle]) === JSON.stringify([resetTypography.styleDefaults.headingStyle, resetTypography.styleDefaults.textStyle]))}
      <Button onClick={() => onChange(resetTypography)}>{publicPageText(locale, 'resetGroup')}</Button>
    </Stack></AccordionDetails></Accordion>
    <Accordion disableGutters expanded={expanded === 'buttons'} onChange={toggle('buttons')} sx={accordionSx}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'buttons')}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>
      <CompactTypographyControls locale={locale} label={publicPageText(locale, 'titleStyle')} value={defaults.linkStyle.titleStyle} resolvedValue={resetButtons.styleDefaults.linkStyle.titleStyle} onChange={(value) => updateButtonTypography('titleStyle', value)} />
      <CompactTypographyControls locale={locale} label={publicPageText(locale, 'subtitleStyle')} value={defaults.linkStyle.subtitleStyle} resolvedValue={resetButtons.styleDefaults.linkStyle.subtitleStyle} onChange={(value) => updateButtonTypography('subtitleStyle', value)} />
      <SettingsRow label={publicPageText(locale, 'background')}>
        <ColorControl variant="chip" label={publicPageText(locale, 'background')} value={defaults.linkStyle.backgroundColor} onChange={(backgroundColor) => updateButtons({ backgroundColor: backgroundColor ?? resetButtons.styleDefaults.linkStyle.backgroundColor })} />
      </SettingsRow>
      <SettingsRow label={`${publicPageText(locale, 'backgroundOpacity')} (%)`}>
        <TextField size="small" type="number" sx={{ width: 90 }} value={Math.round(defaults.linkStyle.backgroundOpacity * 100)} slotProps={{ htmlInput: { min: 0, max: 100, 'aria-label': `${publicPageText(locale, 'backgroundOpacity')} (%)` } }} onChange={(event) => updateButtons({ backgroundOpacity: Math.max(0, Math.min(100, Number(event.target.value))) / 100 })} />
      </SettingsRow>
      <SettingsRow label={publicPageText(locale, 'borderRadius')}>
        <TextField size="small" type="number" sx={{ width: 90 }} value={theme.tokens.layout.linkRadius} slotProps={{ htmlInput: { min: 0, max: 100, 'aria-label': publicPageText(locale, 'borderRadius') } }} onChange={(event) => {
          const radius = Math.max(0, Math.min(100, Number(event.target.value)));
          onChange({ ...theme, tokens: { ...theme.tokens, layout: { ...theme.tokens.layout, linkRadius: radius } } });
        }} />
      </SettingsRow>
      <SettingsRow label={publicPageText(locale, 'borderWidth')}>
        <TextField size="small" type="number" sx={{ width: 90 }} value={defaults.linkStyle.borderWidth} slotProps={{ htmlInput: { min: 0, max: 16, 'aria-label': publicPageText(locale, 'borderWidth') } }} onChange={(event) => updateButtons({ borderWidth: Math.max(0, Math.min(16, Number(event.target.value))) })} />
      </SettingsRow>
      <SettingsRow label={publicPageText(locale, 'borderColor')}>
        <ColorControl variant="chip" label={publicPageText(locale, 'borderColor')} value={defaults.linkStyle.borderColor} onChange={(borderColor) => updateButtons({ borderColor: borderColor ?? resetButtons.styleDefaults.linkStyle.borderColor })} />
      </SettingsRow>
      <SettingsRow label={publicPageText(locale, 'shadow')}>
        <Switch checked={defaults.linkStyle.shadow} onChange={(_, shadow) => updateButtons({ shadow })} slotProps={{ input: { 'aria-label': publicPageText(locale, 'shadow') } }} />
      </SettingsRow>
      {source(JSON.stringify(defaults.linkStyle) === JSON.stringify(resetButtons.styleDefaults.linkStyle) && theme.tokens.layout.linkRadius === resetButtons.tokens.layout.linkRadius)}
      <Button onClick={() => onChange(resetButtons)}>{publicPageText(locale, 'resetGroup')}</Button>
    </Stack></AccordionDetails></Accordion>
    <Accordion disableGutters expanded={expanded === 'background'} onChange={toggle('background')} sx={accordionSx}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'pageBackground')}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>
      <SettingsRow label={publicPageText(locale, 'background')}>
        <ColorControl variant="chip" label={publicPageText(locale, 'background')} value={theme.colors.background} onChange={(background) => onChange(applyPublicPageThemeColors(theme, { background: background ?? '#ffffff' }))} />
      </SettingsRow>
      <Button onClick={() => onChange(resetPublicPageDesignGroup(theme, 'background'))}>{publicPageText(locale, 'resetGroup')}</Button>
    </Stack></AccordionDetails></Accordion>
    <Accordion disableGutters expanded={expanded === 'sections'} onChange={toggle('sections')} sx={accordionSx}><AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle1">{publicPageText(locale, 'sectionDefaults')}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>
      <SettingsRow label={publicPageText(locale, 'primarySection')}>
        <ColorControl variant="chip" label={publicPageText(locale, 'primarySection')} value={theme.colors.primary} onChange={(primary) => onChange(applyPublicPageThemeColors(theme, { primary: primary ?? resetSections.colors.primary }))} />
      </SettingsRow>
      <SettingsRow label={publicPageText(locale, 'secondarySection')}>
        <ColorControl variant="chip" label={publicPageText(locale, 'secondarySection')} value={theme.colors.surface} onChange={(surface) => onChange(applyPublicPageThemeColors(theme, { surface: surface ?? resetSections.colors.surface }))} />
      </SettingsRow>
      <SettingsRow label={publicPageText(locale, 'borderRadius')}>
        <TextField size="small" type="number" sx={{ width: 90 }} value={defaults.sectionBorderRadius} slotProps={{ htmlInput: { min: 0, max: 100, 'aria-label': publicPageText(locale, 'borderRadius') } }} onChange={(event) => onChange({ ...theme, styleDefaults: { ...defaults, sectionBorderRadius: Math.max(0, Math.min(100, Number(event.target.value))) } })} />
      </SettingsRow>
      <Button onClick={() => onChange(resetSections)}>{publicPageText(locale, 'resetGroup')}</Button>
    </Stack></AccordionDetails></Accordion>
  </Stack>;
}
