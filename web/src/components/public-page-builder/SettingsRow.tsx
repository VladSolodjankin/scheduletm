import ExpandMore from '@mui/icons-material/ExpandMore';
import { Box, Menu, MenuItem, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { useState, type ReactNode } from 'react';

export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minHeight: 44 }}>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{label}</Typography>
      <Box sx={{ flexShrink: 0 }}>{children}</Box>
    </Stack>
  );
}

export const chipButtonSx: SxProps<Theme> = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75,
  minWidth: 120, maxWidth: { xs: 160, sm: 220 }, height: 36, px: 1.25,
  borderRadius: 2, border: '1px solid', borderColor: 'divider',
  bgcolor: 'background.paper', color: 'text.primary', cursor: 'pointer',
  font: 'inherit', typography: 'body2',
  '&:hover': { borderColor: 'text.secondary' },
};

const chipValueSx: SxProps<Theme> = {
  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left',
};

export function SelectChip<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = options.find((option) => option.value === value);
  return (
    <>
      <Box component="button" type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)} sx={chipButtonSx}>
        <Box component="span" sx={chipValueSx}>{current?.label ?? value}</Box>
        <ExpandMore fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {options.map((option) => (
          <MenuItem key={option.value} selected={option.value === value} onClick={() => { onChange(option.value); setAnchor(null); }}>
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
