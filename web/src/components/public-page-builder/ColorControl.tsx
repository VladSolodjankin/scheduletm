import { Box, Stack, TextField, Tooltip } from '@mui/material';

export function ColorControl(props: {
  label: string;
  value: string | null;
  resolvedValue?: string | null;
  onChange: (value: string | null) => void;
  presetColors?: readonly string[];
  compact?: boolean;
}) {
  const displayValue = props.value ?? props.resolvedValue ?? '';
  const pickerValue = /^#[\da-f]{6}$/i.test(displayValue) ? displayValue : '#ffffff';
  return (
    <Stack spacing={1}>
      {props.presetColors?.length ? <Stack direction="row" spacing={0.75}>
        {props.presetColors.map((color) => <Tooltip key={color} title={color}><Box component="button" type="button" aria-label={`${props.label}: ${color}`}
          onClick={() => props.onChange(color)} sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: color, cursor: 'pointer', border: displayValue.toLowerCase() === color.toLowerCase() ? '2px solid' : '1px solid', borderColor: displayValue.toLowerCase() === color.toLowerCase() ? 'primary.main' : 'divider' }} /></Tooltip>)}
      </Stack> : null}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Tooltip title={`${props.label}: ${displayValue}`}><Box component="input"
        aria-label={props.label}
        type="color"
        value={pickerValue}
        onChange={(event) => props.onChange(event.target.value)}
        sx={props.compact ? { width: 32, height: 32, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' } : undefined}
      /></Tooltip>
      {!props.compact ? <TextField
        fullWidth
        size="small"
        label={props.label}
        value={displayValue}
        onChange={(event) => props.onChange(event.target.value || null)}
      /> : null}
      </Stack>
    </Stack>
  );
}
