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
import type { Locale } from '../../shared/i18n/dictionaries';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { PALETTE_VARIANTS } from '../../shared/theme/constants';
import { AppIcons } from '../../shared/ui/AppIcons';
import logoText from '../../static/images/logo_text.svg';
import logoShort from '../../static/images/logo_short.svg';

type HeaderProps = {
  title: string;
  mode: 'light' | 'dark';
  paletteVariantId: PaletteVariantId;
  paletteSelectAriaLabel: string;
  themeToggleAriaLabel: string;
  languageSelectAriaLabel: string;
  localeLabel: string;
  locale: Locale;
  onToggleMode: () => void;
  onChangePalette: (paletteVariantId: PaletteVariantId) => void;
  onChangeLocale: (locale: Locale) => void;
};

export function Header({
  title,
  mode,
  paletteVariantId,
  paletteSelectAriaLabel,
  themeToggleAriaLabel,
  languageSelectAriaLabel,
  localeLabel,
  locale,
  onToggleMode,
  onChangePalette,
  onChangeLocale
}: HeaderProps) {
  const ThemeIcon = mode === 'dark' ? AppIcons.lightMode : AppIcons.darkMode;

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            component="img"
            src={logoText}
            alt={title}
            sx={{ height: 28, display: { xs: 'none', sm: 'block' } }}
          />
          <Box
            component="img"
            src={logoShort}
            alt={title}
            sx={{ height: 30, display: { xs: 'block', sm: 'none' } }}
          />
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <AppIcons.palette color="action" />
          <Select
            size="small"
            value={paletteVariantId}
            onChange={(event) => onChangePalette(event.target.value as PaletteVariantId)}
            aria-label={paletteSelectAriaLabel}
          >
            {PALETTE_VARIANTS.map((variant) => (
              <MenuItem key={variant.id} value={variant.id}>
                {variant.label}
              </MenuItem>
            ))}
          </Select>

          <Typography variant="body2" color="text.secondary">
            {localeLabel}
          </Typography>
          <Select
            size="small"
            value={locale}
            onChange={(event) => onChangeLocale(event.target.value as Locale)}
            aria-label={languageSelectAriaLabel}
          >
            <MenuItem value="ru">Русский</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>

          <IconButton onClick={onToggleMode} color="primary" aria-label={themeToggleAriaLabel}>
            <ThemeIcon />
          </IconButton>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
