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
import { PALETTE_VARIANTS, rem } from '../../shared/theme/constants';
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
  showMobileMenuButton?: boolean;
  onToggleMode: () => void;
  onOpenMobileMenu?: () => void;
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
  showMobileMenuButton = false,
  onToggleMode,
  onOpenMobileMenu,
  onChangePalette,
  onChangeLocale
}: HeaderProps) {
  const ThemeIcon = mode === 'dark' ? AppIcons.lightMode : AppIcons.darkMode;
  const MenuIcon = AppIcons.menu;
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
        backdropFilter: `blur(${rem(14)})`,
        ...(theme.palette.mode === 'dark' ? { bgcolor: 'rgba(15, 23, 42, 0.72)' } : {})
      }}
    >
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: { xs: rem(56), sm: rem(64) }, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showMobileMenuButton ? (
            <IconButton
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
          <Box
            component="img"
            src={logoText}
            alt={title}
            sx={{ height: rem(28), display: { xs: 'none', sm: 'block' } }}
          />
          <Box
            component="img"
            src={logoShort}
            alt={title}
            sx={{ height: rem(30), display: { xs: 'block', sm: 'none' } }}
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
                  sx={{ minWidth: rem(130) }}
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
                  sx={isMobile ? { minWidth: rem(52) } : { minWidth: rem(72) }}
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
