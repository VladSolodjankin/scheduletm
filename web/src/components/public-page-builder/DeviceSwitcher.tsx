import Laptop from '@mui/icons-material/Laptop';
import PhoneIphone from '@mui/icons-material/PhoneIphone';
import TabletMac from '@mui/icons-material/TabletMac';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

export function DeviceSwitcher({
  value,
  onChange,
  locale,
  compact = false,
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
  locale: Locale;
  compact?: boolean;
}) {
  const items = [
    ['desktop', translate(locale, 'publicPageBuilder.deviceDesktop'), <Laptop key="desktop" fontSize="small" />],
    ['tablet', translate(locale, 'publicPageBuilder.deviceTablet'), <TabletMac key="tablet" fontSize="small" />],
    ['mobile', translate(locale, 'publicPageBuilder.deviceMobile'), <PhoneIphone key="mobile" fontSize="small" />],
  ] as const;
  return (
    <ToggleButtonGroup
      exclusive
      aria-label={translate(locale, 'publicPageBuilder.preview')}
      size="small"
      value={value}
      onChange={(_, next: PreviewDevice | null) => next && onChange(next)}
      sx={{ gap: compact ? 0.5 : 1, flexShrink: 0, '& .MuiToggleButton-root': { px: compact ? 0 : 1.5, minWidth: compact ? 44 : 'auto', height: compact ? 44 : 36, gap: 0.75, color: 'text.secondary', textTransform: 'none',
        '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } } },
        '& .MuiToggleButtonGroup-grouped': { m: 0, border: 0, borderRadius: 1 } }}
    >
      {items.map(([device, label, icon]) => (
        <ToggleButton key={device} value={device} aria-label={label} disabled={compact && device !== 'mobile'}>
          <Tooltip title={label}>{icon}</Tooltip>
          {compact ? null : label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
