import FormatAlignCenter from '@mui/icons-material/FormatAlignCenter';
import FormatAlignLeft from '@mui/icons-material/FormatAlignLeft';
import FormatAlignRight from '@mui/icons-material/FormatAlignRight';
import WidthFull from '@mui/icons-material/WidthFull';
import WidthNormal from '@mui/icons-material/WidthNormal';
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { createSvgIcon } from '@mui/material/utils';
import type { ReactNode } from 'react';
import type { ItemSize, LinkAlign, LinkWidth, PageWidth } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';
import type { PublicPageBuilderKey } from '../../shared/i18n/dictionaries';

/** One wide tile: the item takes the full row. */
export const FullSizeIcon = createSvgIcon(<rect x="3" y="7" width="18" height="10" rx="2" />, 'FullSize');
/** Two tiles side by side, the left one is the item: it takes half of the row. */
export const HalfSizeIcon = createSvgIcon(
  <>
    <rect x="3" y="7" width="8" height="10" rx="2" />
    <rect x="13" y="7" width="8" height="10" rx="2" fillOpacity="0.35" />
  </>,
  'HalfSize',
);

const ITEM_SIZES: ReadonlyArray<{ value: ItemSize; icon: ReactNode; label: 'sizeFull' | 'sizeHalf' }> = [
  { value: 'full', icon: <FullSizeIcon fontSize="small" />, label: 'sizeFull' },
  { value: 'half', icon: <HalfSizeIcon fontSize="small" />, label: 'sizeHalf' },
];
const LINK_WIDTHS: ReadonlyArray<{ value: LinkWidth; icon: ReactNode; label: 'buttonWidthFull' | 'buttonWidthAuto' }> = [
  { value: 'full', icon: <WidthFull fontSize="small" />, label: 'buttonWidthFull' },
  { value: 'auto', icon: <WidthNormal fontSize="small" />, label: 'buttonWidthAuto' },
];
const LINK_ALIGNS: ReadonlyArray<{ value: LinkAlign; icon: ReactNode; label: 'alignLeft' | 'alignCenter' | 'alignRight' }> = [
  { value: 'left', icon: <FormatAlignLeft fontSize="small" />, label: 'alignLeft' },
  { value: 'center', icon: <FormatAlignCenter fontSize="small" />, label: 'alignCenter' },
  { value: 'right', icon: <FormatAlignRight fontSize="small" />, label: 'alignRight' },
];

type IconChoiceProps<T extends string> = {
  locale: Locale;
  ariaLabel: string;
  options: ReadonlyArray<{ value: T; icon: ReactNode; label: PublicPageBuilderKey }>;
  value: T | null;
  /** When set, the active choice can be cleared again (to inherit the value). */
  clearable?: boolean;
  onChange: (value: T | null) => void;
};

function IconChoice<T extends string>({ locale, ariaLabel, options, value, clearable = false, onChange }: IconChoiceProps<T>) {
  return <ToggleButtonGroup exclusive size="small" aria-label={ariaLabel} value={value}
    onChange={(_event, next: T | null) => { if (next !== null || clearable) {onChange(next);} }}>
    {options.map((option) => <Tooltip key={option.value} title={translate(locale, `publicPageBuilder.${option.label}`)}>
      <ToggleButton value={option.value} aria-label={translate(locale, `publicPageBuilder.${option.label}`)}>{option.icon}</ToggleButton>
    </Tooltip>)}
  </ToggleButtonGroup>;
}

/** Icon-only size switch used in the hover toolbar of blocks and sections. */
export function ItemSizeToggle({ locale, size, onChange }: { locale: Locale; size: ItemSize; onChange: (size: ItemSize) => void }) {
  return <IconChoice locale={locale} ariaLabel={translate(locale, 'publicPageBuilder.sizeFull')} options={ITEM_SIZES} value={size}
    onChange={(next) => { if (next) {onChange(next);} }} />;
}

export function PageWidthControl({ locale, value, onChange }: { locale: Locale; value: PageWidth; onChange: (value: PageWidth) => void }) {
  const options = [
    { value: 'narrow', label: 'pageWidthNarrow' },
    { value: 'medium', label: 'pageWidthMedium' },
    { value: 'wide', label: 'pageWidthWide' },
  ] as const;
  return <ToggleButtonGroup exclusive fullWidth size="small" aria-label={translate(locale, 'publicPageBuilder.pageWidth')} value={value}
    onChange={(_event, next: PageWidth | null) => { if (next) {onChange(next);} }}>
    {options.map((option) => <ToggleButton key={option.value} value={option.value}>{translate(locale, `publicPageBuilder.${option.label}`)}</ToggleButton>)}
  </ToggleButtonGroup>;
}

type LinkLayoutControlsProps = {
  locale: Locale;
  width: LinkWidth | null;
  align: LinkAlign | null;
  /** Section and block levels may leave a value unset to use the one from the level above. */
  inheritable?: boolean;
  onWidthChange: (width: LinkWidth | null) => void;
  onAlignChange: (align: LinkAlign | null) => void;
};

export function LinkLayoutControls({ locale, width, align, inheritable = false, onWidthChange, onAlignChange }: LinkLayoutControlsProps) {
  const unset = inheritable && (width === null || align === null);
  return <Stack spacing={1.5}>
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="body2">{translate(locale, 'publicPageBuilder.buttonWidth')}</Typography>
      <IconChoice locale={locale} ariaLabel={translate(locale, 'publicPageBuilder.buttonWidth')} options={LINK_WIDTHS} value={width} clearable={inheritable} onChange={onWidthChange} />
    </Stack>
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="body2">{translate(locale, 'publicPageBuilder.buttonAlign')}</Typography>
      <IconChoice locale={locale} ariaLabel={translate(locale, 'publicPageBuilder.buttonAlign')} options={LINK_ALIGNS} value={align} clearable={inheritable} onChange={onAlignChange} />
    </Stack>
    {unset ? <Typography variant="caption" color="text.secondary">{translate(locale, 'publicPageBuilder.useTheme')}</Typography> : null}
  </Stack>;
}
