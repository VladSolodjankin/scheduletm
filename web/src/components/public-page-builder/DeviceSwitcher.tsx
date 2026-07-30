import { Laptop, PhoneIphone, TabletMac } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

export function DeviceSwitcher({
  value,
  onChange,
  locale,
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
  locale: Locale;
}) {
  const items = [
    ['mobile', publicPageText(locale, 'deviceMobile'), <PhoneIphone key="mobile" />],
    ['tablet', publicPageText(locale, 'deviceTablet'), <TabletMac key="tablet" />],
    ['desktop', publicPageText(locale, 'deviceDesktop'), <Laptop key="desktop" />],
  ] as const;
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: PreviewDevice | null) => next && onChange(next)}
    >
      {items.map(([device, label, icon]) => (
        <ToggleButton key={device} value={device} aria-label={label}>
          <Tooltip title={label}>{icon}</Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
