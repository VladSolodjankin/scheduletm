import { Box, Stack, TextField, Tooltip } from '@mui/material';

export function ColorControl(props: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  presetColors?: readonly string[];
}) {
  const value = props.value ?? '#ffffff';
  return (
    <Stack spacing={1}>
      {props.presetColors?.length ? <Stack direction="row" spacing={0.75}>
        {props.presetColors.map((color) => <Tooltip key={color} title={color}><Box component="button" type="button" aria-label={`${props.label}: ${color}`}
          onClick={() => props.onChange(color)} sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: color, cursor: 'pointer', border: value.toLowerCase() === color.toLowerCase() ? '2px solid' : '1px solid', borderColor: value.toLowerCase() === color.toLowerCase() ? 'primary.main' : 'divider' }} /></Tooltip>)}
      </Stack> : null}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <input
        aria-label={props.label}
        type="color"
        value={value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <TextField
        fullWidth
        size="small"
        label={props.label}
        value={props.value ?? ''}
        onChange={(event) => props.onChange(event.target.value || null)}
      />
      </Stack>
    </Stack>
  );
}
