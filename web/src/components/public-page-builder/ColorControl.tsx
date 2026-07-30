import { Stack, TextField } from '@mui/material';

export function ColorControl(props: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const value = props.value ?? '#ffffff';
  return (
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
  );
}
