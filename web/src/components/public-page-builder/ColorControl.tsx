import ExpandMore from '@mui/icons-material/ExpandMore';
import { Box, Popover, Stack, TextField, Tooltip } from '@mui/material';
import { useState } from 'react';
import { chipButtonSx } from './SettingsRow';

export function ColorControl(props: {
  label: string;
  value: string | null;
  resolvedValue?: string | null;
  onChange: (value: string | null) => void;
  presetColors?: readonly string[];
  compact?: boolean;
  variant?: 'inline' | 'chip';
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const displayValue = props.value ?? props.resolvedValue ?? '';
  const pickerValue = /^#[\da-f]{6}$/i.test(displayValue) ? displayValue : '#ffffff';
  const body = (
    <Stack spacing={1}>
      {props.presetColors?.length ? <Stack direction="row" spacing={0.75}>
        {props.presetColors.map((color, index) => <Tooltip key={`${color}-${index}`} title={color}><Box component="button" type="button" aria-label={`${props.label}: ${color}`}
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
  if (props.variant !== 'chip') {return body;}
  return (
    <>
      <Box component="button" type="button" aria-label={props.label} aria-haspopup="dialog" aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)} sx={chipButtonSx}>
        <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, bgcolor: pickerValue, border: '1px solid', borderColor: 'divider' }} />
        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {displayValue || '—'}
        </Box>
        <ExpandMore fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
      </Box>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ p: 2, width: 240 }}>{body}</Box>
      </Popover>
    </>
  );
}
