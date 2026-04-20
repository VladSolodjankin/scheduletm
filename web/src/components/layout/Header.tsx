import {
  AppBar,
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography
} from '@mui/material';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { PALETTE_VARIANTS } from '../../shared/theme/constants';
import { AppIcons } from '../../shared/ui/AppIcons';

type HeaderProps = {
  title: string;
  mode: 'light' | 'dark';
  paletteVariantId: PaletteVariantId;
  onToggleMode: () => void;
  onChangePalette: (paletteVariantId: PaletteVariantId) => void;
};

export function Header({
  title,
  mode,
  paletteVariantId,
  onToggleMode,
  onChangePalette
}: HeaderProps) {
  const ThemeIcon = mode === 'dark' ? AppIcons.lightMode : AppIcons.darkMode;

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6">{title}</Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1.5} alignItems="center">
          <AppIcons.palette color="action" />
          <Select
            size="small"
            value={paletteVariantId}
            onChange={(event) => onChangePalette(event.target.value as PaletteVariantId)}
          >
            {PALETTE_VARIANTS.map((variant) => (
              <MenuItem key={variant.id} value={variant.id}>
                {variant.label}
              </MenuItem>
            ))}
          </Select>
          <IconButton onClick={onToggleMode} color="primary" aria-label="toggle-theme">
            <ThemeIcon />
          </IconButton>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
