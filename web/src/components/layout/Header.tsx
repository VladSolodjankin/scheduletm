import {
  AppBar,
  Box,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Toolbar,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import type { Locale } from '../../shared/i18n/dictionaries';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { PALETTE_VARIANTS } from '../../shared/theme/constants';
import { AppIcons } from '../../shared/ui/AppIcons';
import logoText from '../../static/images/logo_text.svg';
import logoShort from '../../static/images/logo_short.svg';
import { UserMenu } from './UserMenu';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(14px)',
        ...(theme.palette.mode === 'dark' ? { bgcolor: 'rgba(15, 23, 42, 0.72)' } : {})
      }}
    >
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
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

        <Stack direction="row" spacing={{ xs: 1, sm: 1.25 }} sx={{ alignItems: 'center' }}>
          {!isMobile && (
            <Paper variant="outlined" sx={{ px: 1, py: 0.75, borderRadius: 999 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <AppIcons.palette color="action" fontSize="small" />
                <Select
                  size="small"
                  variant="standard"
                  disableUnderline
                  value={paletteVariantId}
                  onChange={(event) => onChangePalette(event.target.value as PaletteVariantId)}
                  aria-label={paletteSelectAriaLabel}
                  sx={{ minWidth: 130 }}
                >
                  {PALETTE_VARIANTS.map((variant) => (
                    <MenuItem key={variant.id} value={variant.id}>
                      {variant.label}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            </Paper>
          )}

          <Tooltip title={localeLabel}>
            <Paper variant="outlined" sx={{ px: 1, py: 0.75, borderRadius: 999 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {!isMobile && <AppIcons.settings color="action" fontSize="small" />}
                <Select
                  size="small"
                  variant="standard"
                  disableUnderline
                  value={locale}
                  onChange={(event) => onChangeLocale(event.target.value as Locale)}
                  aria-label={languageSelectAriaLabel}
                  sx={isMobile ? { minWidth: 52 } : { minWidth: 72 }}
                >
                  <MenuItem value="ru">RU</MenuItem>
                  <MenuItem value="en">EN</MenuItem>
                </Select>
              </Stack>
            </Paper>
          </Tooltip>

          <Tooltip title={themeToggleAriaLabel}>
            <IconButton onClick={onToggleMode} color="primary" aria-label={themeToggleAriaLabel}>
              <ThemeIcon />
            </IconButton>
          </Tooltip>

          <UserMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
