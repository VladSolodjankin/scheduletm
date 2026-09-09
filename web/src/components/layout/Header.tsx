import {
  AppBar,
  Box,
  IconButton,
  MenuItem,
  Select,
  Toolbar,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Locale } from '../../shared/i18n/dictionaries';
import { AppIcons } from '../../shared/ui/AppIcons';
import logoText from '../../static/images/logo_text.svg';
import { UserMenu } from './UserMenu';

type HeaderProps = {
  title: string;
  mode: 'light' | 'dark';
  themeToggleAriaLabel: string;
  languageSelectAriaLabel: string;
  localeLabel: string;
  locale: Locale;
  showMobileMenuButton?: boolean;
  onToggleMode: () => void;
  onOpenMobileMenu?: () => void;
  onChangeLocale: (locale: Locale) => void;
};

export function Header({
  title,
  mode,
  themeToggleAriaLabel,
  languageSelectAriaLabel,
  localeLabel,
  locale,
  showMobileMenuButton = false,
  onToggleMode,
  onOpenMobileMenu,
  onChangeLocale,
}: HeaderProps) {
  const ThemeIcon = mode === 'dark' ? AppIcons.lightMode : AppIcons.darkMode;
  const MenuIcon = AppIcons.menu;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <AppBar position="sticky" color="inherit" elevation={0} className="app-header">
      <Toolbar className="app-header__toolbar">
        <Box className="app-header__brand">
          {showMobileMenuButton ? (
            <IconButton
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="app-header__icon-action"
            >
              <MenuIcon className="app-icon--m" />
            </IconButton>
          ) : null}
          <Box component="img" src={logoText} alt={title} className="app-header__logo" />
        </Box>

        <Box className="app-header__spacer" />

        <Box className="app-header__controls">
          <Tooltip title={localeLabel}>
            <Box className="app-header__control">
              {!isMobile && <AppIcons.settings color="action" fontSize="small" className="app-icon--s" />}
              <Select
                size="small"
                variant="standard"
                disableUnderline
                value={locale}
                onChange={(event) => onChangeLocale(event.target.value as Locale)}
                aria-label={languageSelectAriaLabel}
                className="app-header__locale"
              >
                <MenuItem value="ru">RU</MenuItem>
                <MenuItem value="en">EN</MenuItem>
              </Select>
            </Box>
          </Tooltip>
          <Tooltip title={themeToggleAriaLabel}>
            <IconButton
              onClick={onToggleMode}
              color="primary"
              aria-label={themeToggleAriaLabel}
              className="app-header__icon-action"
            >
              <ThemeIcon className="app-icon--m" />
            </IconButton>
          </Tooltip>
          <UserMenu />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
