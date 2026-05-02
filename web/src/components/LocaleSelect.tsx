import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

type LocaleSelectProps = {
  label: string;
  labelId: string;
  value: string;
  onChange: (next: string) => void;
  fullWidth?: boolean;
  margin?: 'none' | 'dense' | 'normal';
};

const AVAILABLE_LOCALES = ['ru-RU', 'en-US'] as const;

export function LocaleSelect({
  label,
  labelId,
  value,
  onChange,
  fullWidth = true,
  margin = 'none',
}: LocaleSelectProps) {
  return (
    <FormControl fullWidth={fullWidth} margin={margin}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value || 'ru-RU'}
        onChange={(event) => onChange(String(event.target.value))}
      >
        {AVAILABLE_LOCALES.map((locale) => (
          <MenuItem key={locale} value={locale}>{locale}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
