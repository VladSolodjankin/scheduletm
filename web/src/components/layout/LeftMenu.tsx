import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { NavLink } from 'react-router-dom';
import type { Locale } from '../../shared/i18n/dictionaries';
import { AppIcons } from '../../shared/ui/AppIcons';
import logoText from '../../static/images/logo_text.svg';
import { UserMenu } from './UserMenu';

type MenuEntry = {
  to: string;
  label: string;
  icon: keyof typeof AppIcons;
};

type LeftMenuProps = {
  items: MenuEntry[];
  headingLabel: string;
  title: string;
  mode: 'light' | 'dark';
  locale: Locale;
  themeToggleAriaLabel: string;
  languageSelectAriaLabel: string;
  mobile?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  onToggleMode: () => void;
  onChangeLocale: (locale: Locale) => void;
};

export function LeftMenu({
  items,
  headingLabel,
  title,
  mode,
  locale,
  themeToggleAriaLabel,
  languageSelectAriaLabel,
  mobile = false,
  onClose,
  onNavigate,
  onToggleMode,
  onChangeLocale,
}: LeftMenuProps) {
  const CloseIcon = AppIcons.close;
  const ThemeIcon = mode === 'dark' ? AppIcons.lightMode : AppIcons.darkMode;

  return (
    <Box component="aside" className={`app-left-menu${mobile ? ' app-left-menu--mobile' : ''}`}>
      <Box className="app-left-menu__header">
        <Box className="app-left-menu__branding">
          <Box component="img" src={logoText} alt={title} className="app-left-menu__logo" />
          <Typography variant="overline" className="app-left-menu__heading">{headingLabel}</Typography>
        </Box>
        {mobile ? (
          <IconButton onClick={onClose} aria-label="Close navigation menu" size="small" className="app-left-menu__close">
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>

      <List className="app-left-menu__nav">
        {items.map((item) => {
          const Icon = AppIcons[item.icon];
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={onNavigate}
              className="app-left-menu__nav-item"
            >
              <ListItemIcon className="app-left-menu__nav-icon">
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography className="app-left-menu__nav-text">{item.label}</Typography>}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box className="app-left-menu__spacer" />

      <Box className="app-left-menu__footer">
        <Divider className="app-left-menu__divider" />
        <Box className="app-left-menu__control-row">
          <Box className="app-left-menu__control app-left-menu__language">
            <AppIcons.settings fontSize="small" />
            <Select
              size="small"
              variant="standard"
              disableUnderline
              value={locale}
              onChange={(event) => onChangeLocale(event.target.value as Locale)}
              aria-label={languageSelectAriaLabel}
              className="app-left-menu__select"
            >
              <MenuItem value="ru">RU</MenuItem>
              <MenuItem value="en">EN</MenuItem>
            </Select>
          </Box>
          <IconButton onClick={onToggleMode} aria-label={themeToggleAriaLabel} className="app-left-menu__theme">
            <ThemeIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box className="app-left-menu__user">
          <UserMenu variant="sidebar" />
        </Box>
      </Box>
    </Box>
  );
}
