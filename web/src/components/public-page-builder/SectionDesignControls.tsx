import { Add, Remove, RestartAlt } from '@mui/icons-material';
import {
  Box,
  FormControlLabel,
  IconButton,
  MenuItem,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import type { PageSection, PageTheme, TypographyStyle } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { publicPageText } from './uiText';
import { resolvePublicPageThemeVariables } from '../public-page-blocks/publicPageThemeVariables';

const SECTION_SPACING_STEP_PX = 14;
const SECTION_SPACING_MAX_STEP = 5;
const TYPOGRAPHY_FONT_OPTIONS = [
  ['Inter', 'Inter, system-ui, sans-serif'],
  ['Roboto', 'Roboto, sans-serif'],
  ['Open Sans', '"Open Sans", sans-serif'],
  ['Montserrat', 'Montserrat, sans-serif'],
  ['Lato', 'Lato, sans-serif'],
] as const;
const TYPOGRAPHY_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 32, 40, 48, 64] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function spacingStep(value: number): number {
  return clamp(Math.round(value / SECTION_SPACING_STEP_PX), 0, SECTION_SPACING_MAX_STEP);
}

function GroupHeading({ children }: { children: ReactNode }) {
  return <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>{children}</Typography>;
}

function SliderRow({ label, value, minimum, maximum, step, valueLabel, onChange }: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
    <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
    <Typography variant="body2" sx={{ minWidth: 38, textAlign: 'right', fontWeight: 600 }}>{valueLabel}</Typography>
    <Slider aria-label={label} value={value} min={minimum} max={maximum} step={step}
      onChange={(_, next) => onChange(next as number)} sx={{ width: 142 }} />
  </Stack>;
}

function NumberStepper({ locale, label, value, inheritedValue, minimum = 0, maximum = 100, onChange, onReset, colorControl }: {
  locale: Locale;
  label: string;
  value: number | null;
  inheritedValue?: number;
  minimum?: number;
  maximum?: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  colorControl?: ReactNode;
}) {
  const displayValue = value ?? inheritedValue ?? minimum;
  const changeBy = (delta: number) => onChange(clamp(displayValue + delta, minimum, maximum));
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
    <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
    <Stack direction="row" sx={{ alignItems: 'center' }}>
      <TextField size="small" value={displayValue}
        aria-label={label} slotProps={{ htmlInput: { readOnly: true } }}
        sx={{ width: 92, '& input': { textAlign: 'right' } }} />
      <Typography variant="caption" color="text.secondary" sx={{ mx: 0.75 }}>{publicPageText(locale, 'pixels')}</Typography>
      <IconButton size="small" aria-label={`${label}: -`} disabled={displayValue <= minimum} onClick={() => changeBy(-1)}><Remove fontSize="small" /></IconButton>
      <IconButton size="small" aria-label={`${label}: +`} disabled={displayValue >= maximum} onClick={() => changeBy(1)}><Add fontSize="small" /></IconButton>
      {onReset ? <Tooltip title={publicPageText(locale, 'inherit')}><span><IconButton size="small"
        aria-label={`${label}: ${publicPageText(locale, 'inherit')}`} disabled={value === null} onClick={onReset}>
        <RestartAlt fontSize="small" />
      </IconButton></span></Tooltip> : null}
    </Stack>
    {colorControl}
  </Stack>;
}

function CompactTypographyControls({ locale, label, value, resolvedValue, onChange }: {
  locale: Locale;
  label: string;
  value: TypographyStyle;
  resolvedValue: TypographyStyle;
  onChange: (value: TypographyStyle) => void;
}) {
  const effectiveFamily = value.fontFamily ?? resolvedValue.fontFamily ?? '';
  const effectiveSize = value.fontSize ?? resolvedValue.fontSize ?? 16;
  const effectiveWeight = value.fontWeight ?? resolvedValue.fontWeight ?? 400;
  const effectiveStyle = value.fontStyle ?? resolvedValue.fontStyle ?? 'normal';
  const fontOptions = TYPOGRAPHY_FONT_OPTIONS.some(([, fontFamily]) => fontFamily === effectiveFamily)
    ? TYPOGRAPHY_FONT_OPTIONS
    : [[effectiveFamily, effectiveFamily] as const, ...TYPOGRAPHY_FONT_OPTIONS];
  const sizeOptions = [...new Set([effectiveSize, ...TYPOGRAPHY_SIZE_OPTIONS])].sort((first, second) => first - second);
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
    <Typography variant="body2" sx={{ minWidth: 92, flex: 1 }}>{label}</Typography>
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', justifyContent: { sm: 'flex-end' }, alignItems: 'center' }}>
      <TextField size="small" select aria-label={`${label}: ${publicPageText(locale, 'fontFamily')}`}
        value={effectiveFamily}
        onChange={(event) => onChange({ ...value, fontFamily: event.target.value || null })}
        sx={{ width: 116 }}>
        {fontOptions.map(([fontLabel, fontFamily]) => <MenuItem key={fontFamily} value={fontFamily}>{fontLabel}</MenuItem>)}
      </TextField>
      <TextField size="small" select aria-label={`${label}: ${publicPageText(locale, 'fontSize')}`}
        value={String(effectiveSize)}
        onChange={(event) => onChange({ ...value, fontSize: Number(event.target.value) })}
        sx={{ width: 62 }}>
        {sizeOptions.map((size) => <MenuItem key={size} value={String(size)}>{size}</MenuItem>)}
      </TextField>
      <TextField size="small" select aria-label={`${label}: ${publicPageText(locale, 'fontWeight')}`}
        value={String(effectiveWeight)}
        onChange={(event) => onChange({ ...value, fontWeight: event.target.value === '' ? null : Number(event.target.value) })}
        sx={{ width: 72 }}>
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => <MenuItem key={weight} value={weight}>{weight}</MenuItem>)}
      </TextField>
      <TextField size="small" select aria-label={`${label}: ${publicPageText(locale, 'fontStyle')}`}
        value={effectiveStyle}
        onChange={(event) => onChange({ ...value, fontStyle: event.target.value === '' ? null : event.target.value as 'normal' | 'italic' })}
        sx={{ width: 86 }}>
        <MenuItem value="normal">{publicPageText(locale, 'normal')}</MenuItem>
        <MenuItem value="italic">{publicPageText(locale, 'italic')}</MenuItem>
      </TextField>
      <ColorControl compact label={`${label}: ${publicPageText(locale, 'textColor')}`} value={value.color}
        resolvedValue={resolvedValue.color} onChange={(color) => onChange({ ...value, color })} />
      <Tooltip title={publicPageText(locale, 'inherit')}><span><IconButton size="small"
        aria-label={`${label}: ${publicPageText(locale, 'inherit')}`}
        disabled={Object.values(value).every((item) => item === null)}
        onClick={() => onChange({ fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null })}>
        <RestartAlt fontSize="small" />
      </IconButton></span></Tooltip>
    </Stack>
  </Stack>;
}

export function SectionDesignControls({ locale, theme, section, backgroundImageControl, onChange }: {
  locale: Locale;
  theme: PageTheme;
  section: PageSection;
  backgroundImageControl?: ReactNode;
  onChange: (section: PageSection) => void;
}) {
  const design = section.design;
  const isOff = design.variant === 'off';
  const updateDesign = (changes: Partial<PageSection['design']>) => onChange({ ...section, design: { ...design, ...changes } });
  const updateLinkStyle = (changes: Partial<PageSection['design']['linkStyle']>) => updateDesign({ linkStyle: { ...design.linkStyle, ...changes } });
  const resolvedVariables = resolvePublicPageThemeVariables(theme, section);
  const resolvedColor = (name: `--${string}`) => String(resolvedVariables[name] ?? '');
  const resolvedHeadingStyle = { ...theme.styleDefaults.headingStyle, color: resolvedColor('--theme-heading-color') };
  const resolvedTextStyle = { ...theme.styleDefaults.textStyle, color: resolvedColor('--theme-text-color') };
  const resolvedLinkTitleStyle = { ...theme.styleDefaults.linkStyle.titleStyle, color: resolvedColor('--theme-link-title-color') };
  const resolvedLinkSubtitleStyle = { ...theme.styleDefaults.linkStyle.subtitleStyle, color: resolvedColor('--theme-link-subtitle-color') };

  return <Box component="fieldset" disabled={isOff} data-section-design-controls data-disabled={isOff ? 'true' : 'false'}
    sx={{ border: 0, m: 0, p: 0, minWidth: 0, opacity: isOff ? 0.5 : 1 }}>
    <Stack spacing={3}>
      <Stack spacing={1.5} data-section-settings-group="general">
        <GroupHeading>{publicPageText(locale, 'general')}</GroupHeading>
        <SliderRow label={publicPageText(locale, 'paddingTop')} value={spacingStep(design.paddingTop)} minimum={0} maximum={5} step={1}
          valueLabel={`${spacingStep(design.paddingTop)}x`} onChange={(value) => updateDesign({ paddingTop: value * SECTION_SPACING_STEP_PX })} />
        <SliderRow label={publicPageText(locale, 'paddingBottom')} value={spacingStep(design.paddingBottom)} minimum={0} maximum={5} step={1}
          valueLabel={`${spacingStep(design.paddingBottom)}x`} onChange={(value) => updateDesign({ paddingBottom: value * SECTION_SPACING_STEP_PX })} />
        <FormControlLabel label={publicPageText(locale, 'horizontalMargin')} control={<Switch checked={design.horizontalMargin}
          onChange={(_, checked) => updateDesign({ horizontalMargin: checked })} />} />
        {!isOff ? <NumberStepper locale={locale} label={publicPageText(locale, 'borderRadius')} value={design.borderRadius}
          inheritedValue={theme.styleDefaults.sectionBorderRadius} onChange={(borderRadius) => updateDesign({ borderRadius })}
          onReset={() => updateDesign({ borderRadius: null })} /> : null}
        <NumberStepper locale={locale} label={publicPageText(locale, 'borderWidth')} value={design.borderWidth} maximum={16}
          onChange={(borderWidth) => updateDesign({ borderWidth })}
          colorControl={<Box sx={{ width: 184 }}><ColorControl label={publicPageText(locale, 'borderColor')} value={design.borderColor}
            resolvedValue="transparent"
            onChange={(borderColor) => updateDesign({ borderColor })} /></Box>} />
      </Stack>

      <Stack spacing={1.5} data-section-settings-group="background">
        <GroupHeading>{publicPageText(locale, 'background')}</GroupHeading>
        <ColorControl label={publicPageText(locale, 'background')} value={design.backgroundColor}
          resolvedValue={resolvedColor('--page-section-background')}
          onChange={(backgroundColor) => updateDesign({ backgroundColor })} />
        {backgroundImageControl}
      </Stack>

      <Stack spacing={1.5} data-section-settings-group="text">
        <GroupHeading>{publicPageText(locale, 'fieldBody')}</GroupHeading>
        <CompactTypographyControls locale={locale} label={publicPageText(locale, 'headingStyle')} value={design.headingStyle}
          resolvedValue={resolvedHeadingStyle}
          onChange={(headingStyle) => updateDesign({ headingStyle })} />
        <CompactTypographyControls locale={locale} label={publicPageText(locale, 'bodyStyle')} value={design.textStyle}
          resolvedValue={resolvedTextStyle}
          onChange={(textStyle) => updateDesign({ textStyle })} />
      </Stack>

      <Stack spacing={1.5} data-section-settings-group="links">
        <GroupHeading>{publicPageText(locale, 'linksStyle')}</GroupHeading>
        <CompactTypographyControls locale={locale} label={publicPageText(locale, 'titleStyle')} value={design.linkStyle.titleStyle}
          resolvedValue={resolvedLinkTitleStyle}
          onChange={(titleStyle) => updateLinkStyle({ titleStyle })} />
        <CompactTypographyControls locale={locale} label={publicPageText(locale, 'subtitleStyle')} value={design.linkStyle.subtitleStyle}
          resolvedValue={resolvedLinkSubtitleStyle}
          onChange={(subtitleStyle) => updateLinkStyle({ subtitleStyle })} />
        <ColorControl label={publicPageText(locale, 'background')} value={design.linkStyle.backgroundColor}
          resolvedValue={resolvedColor('--theme-link-background')}
          onChange={(backgroundColor) => updateLinkStyle({ backgroundColor })} />
        <SliderRow label={publicPageText(locale, 'backgroundOpacity')}
          value={Math.round((design.linkStyle.backgroundOpacity ?? theme.styleDefaults.linkStyle.backgroundOpacity) * 100)}
          minimum={0} maximum={100} step={1}
          valueLabel={`${Math.round((design.linkStyle.backgroundOpacity ?? theme.styleDefaults.linkStyle.backgroundOpacity) * 100)}%`}
          onChange={(value) => updateLinkStyle({ backgroundOpacity: value / 100 })} />
        <NumberStepper locale={locale} label={publicPageText(locale, 'borderWidth')} value={design.linkStyle.borderWidth}
          inheritedValue={theme.styleDefaults.linkStyle.borderWidth} maximum={16}
          onChange={(borderWidth) => updateLinkStyle({ borderWidth })}
          onReset={() => updateLinkStyle({ borderWidth: null })}
          colorControl={<Box sx={{ width: 184 }}><ColorControl label={publicPageText(locale, 'borderColor')} value={design.linkStyle.borderColor}
            resolvedValue={resolvedColor('--theme-link-border-color')}
            onChange={(borderColor) => updateLinkStyle({ borderColor })} /></Box>} />
        <TextField size="small" select label={publicPageText(locale, 'shadow')}
          value={design.linkStyle.shadow === null ? '' : String(design.linkStyle.shadow)}
          onChange={(event) => updateLinkStyle({ shadow: event.target.value === '' ? null : event.target.value === 'true' })}>
          <MenuItem value="">{publicPageText(locale, 'inherit')}</MenuItem>
          <MenuItem value="true">{publicPageText(locale, 'show')}</MenuItem>
          <MenuItem value="false">{publicPageText(locale, 'hide')}</MenuItem>
        </TextField>
      </Stack>
    </Stack>
  </Box>;
}
