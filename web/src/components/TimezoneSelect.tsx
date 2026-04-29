import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

import { AVAILABLE_TIMEZONES } from './appointments/appointmentsUtils';

type TimezoneSelectProps = {
  label: string;
  labelId: string;
  value: string;
  onChange: (next: string) => void;
  fullWidth?: boolean;
  margin?: 'none' | 'dense' | 'normal';
};

export function TimezoneSelect({
  label,
  labelId,
  value,
  onChange,
  fullWidth = true,
  margin = 'none',
}: TimezoneSelectProps) {
  return (
    <FormControl fullWidth={fullWidth} margin={margin}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value || 'UTC'}
        onChange={(event) => onChange(String(event.target.value))}
      >
        {AVAILABLE_TIMEZONES.map((timeZone) => (
          <MenuItem key={timeZone} value={timeZone}>{timeZone}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
