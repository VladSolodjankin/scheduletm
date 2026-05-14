import { Box, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Select, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { NavLink } from 'react-router-dom';
import type { Locale } from '../../shared/i18n/dictionaries';
import { APP_SHADOWS, APP_SIZING, PALETTE_VARIANTS, rem } from '../../shared/theme/constants';
import type { PaletteVariantId } from '../../shared/theme/constants';
import { AppIcons } from '../../shared/ui/AppIcons';
import logoText from '../../static/images/logo_text.svg';
import { UserMenu } from './UserMenu';

type MenuItem = {
  to: string;
  label: string;
  icon: keyof typeof AppIcons;
};

type LeftMenuProps = {
  items: MenuItem[];
  headingLabel: string;
  title: string;
  mode: 'light' | 'dark';
  paletteVariantId: PaletteVariantId;
  locale: Locale;
  paletteSelectAriaLabel: string;
  themeToggleAriaLabel: string;
  languageSelectAriaLabel: string;
  mobile?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  onToggleMode: () => void;
  onChangePalette: (paletteVariantId: PaletteVariantId) => void;
  onChangeLocale: (locale: Locale) => void;
};

export function LeftMenu({
  items,
  headingLabel,
  title,
  mode,
  paletteVariantId,
  locale,
  paletteSelectAriaLabel,
  themeToggleAriaLabel,
  languageSelectAriaLabel,
  mobile = false,
  onClose,
  onNavigate,
  onToggleMode,
  onChangePalette,
  onChangeLocale
}: LeftMenuProps) {
  const CloseIcon = AppIcons.close;
  const ThemeIcon = mode === 'dark' ? AppIcons.lightMode : AppIcons.darkMode;
  const theme = useTheme();
  const menuBackground = theme.palette.mode === 'light'
    ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.96)} 0%, ${alpha(theme.palette.secondary.main, 0.88)} 100%)`
    : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.48)} 0%, ${alpha(theme.palette.secondary.main, 0.34)} 100%)`;
  const sidebarBorder = alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.22 : 0.08);
  const navTextColor = alpha(theme.palette.common.white, 0.9);
  const navSecondaryColor = alpha(theme.palette.common.white, 0.7);
  const menuHoverBackground = alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.1 : 0.08);
  const menuActiveBackground = theme.palette.mode === 'light'
    ? 'linear-gradient(135deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.18) 100%)'
    : `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.16)} 0%, ${alpha(theme.palette.common.white, 0.1)} 100%)`;
  const controlBackground = alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.12 : 0.06);
  const controlBorder = alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.18 : 0.08);

  return (
    <Box
      component="aside"
      sx={{
        width: mobile ? '100%' : rem(APP_SIZING.leftMenuWidth),
        flexShrink: 0,
        backgroundImage: menuBackground,
        color: navTextColor,
        borderRadius: 0,
        px: 2,
        py: mobile ? 2 : 2.25,
        display: mobile ? 'block' : { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        overflowY: 'auto',
        height: '100%',
        position: 'relative',
        boxShadow: theme.palette.mode === 'light' ? APP_SHADOWS.surfaceLight : APP_SHADOWS.surfaceDark,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at top left, ${alpha(theme.palette.common.white, 0.18)} 0%, transparent 36%)`,
          pointerEvents: 'none'
        }
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.25, position: 'relative', zIndex: 1 }}>
        <Stack spacing={0.75}>
          <Box
            component="img"
            src={logoText}
            alt={title}
            sx={{
              height: rem(28),
              width: 'auto',
              filter: 'brightness(0) invert(1)'
            }}
          />
          <Typography variant="overline" sx={{ letterSpacing: '0.14em', color: navSecondaryColor }}>
            {headingLabel}
          </Typography>
        </Stack>
        {mobile ? (
          <IconButton onClick={onClose} aria-label="Close navigation menu" size="small" sx={{ color: navTextColor }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Stack>
      <List sx={{ mt: 2.5, position: 'relative', zIndex: 1 }}>
        {items.map((item) => {
          const Icon = AppIcons[item.icon];
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={onNavigate}
              sx={{
                borderRadius: 3,
                marginBottom: 0.75,
                minHeight: rem(52),
                px: 1.25,
                color: navTextColor,
                border: `1px solid transparent`,
                transition: theme.transitions.create(['background-color', 'transform', 'border-color', 'box-shadow'], {
                  duration: theme.transitions.duration.shorter
                }),
                '&:hover': {
                  bgcolor: menuHoverBackground,
                  transform: 'translateX(2px)'
                },
                '&.active': {
                  background: menuActiveBackground,
                  color: theme.palette.common.white,
                  borderColor: sidebarBorder,
                  boxShadow: `0 ${rem(16)} ${rem(36)} ${alpha(theme.palette.common.black, 0.12)}`,
                  '& .MuiListItemIcon-root': {
                    color: theme.palette.common.white
                  }
                }
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: rem(40),
                  color: alpha(theme.palette.common.white, 0.8)
                }}
              >
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={(
                  <Typography sx={{ fontSize: rem(15), fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                )}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Stack spacing={1.25} sx={{ mt: 2, position: 'relative', zIndex: 1 }}>
        <Divider sx={{ borderColor: sidebarBorder }} />

        <Stack spacing={1}>
          <Box
            sx={{
              px: 1.25,
              py: 0.75,
              borderRadius: 3,
              bgcolor: controlBackground,
              border: `1px solid ${controlBorder}`
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AppIcons.palette fontSize="small" sx={{ color: navTextColor }} />
              <Select
                size="small"
                variant="standard"
                disableUnderline
                value={paletteVariantId}
                onChange={(event) => onChangePalette(event.target.value as PaletteVariantId)}
                aria-label={paletteSelectAriaLabel}
                sx={{
                  minWidth: 0,
                  flexGrow: 1,
                  color: navTextColor,
                  '& .MuiSelect-icon': {
                    color: navSecondaryColor
                  }
                }}
              >
                {PALETTE_VARIANTS.map((variant) => (
                  <MenuItem key={variant.id} value={variant.id}>
                    {variant.label}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1}>
            <Box
              sx={{
                flexGrow: 1,
                px: 1.25,
                py: 0.75,
                borderRadius: 3,
                bgcolor: controlBackground,
                border: `1px solid ${controlBorder}`
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <AppIcons.settings fontSize="small" sx={{ color: navTextColor }} />
                <Select
                  size="small"
                  variant="standard"
                  disableUnderline
                  value={locale}
                  onChange={(event) => onChangeLocale(event.target.value as Locale)}
                  aria-label={languageSelectAriaLabel}
                  sx={{
                    minWidth: 0,
                    flexGrow: 1,
                    color: navTextColor,
                    '& .MuiSelect-icon': {
                      color: navSecondaryColor
                    }
                  }}
                >
                  <MenuItem value="ru">RU</MenuItem>
                  <MenuItem value="en">EN</MenuItem>
                </Select>
              </Stack>
            </Box>

            <IconButton
              onClick={onToggleMode}
              aria-label={themeToggleAriaLabel}
              sx={{
                borderRadius: 3,
                color: navTextColor,
                bgcolor: controlBackground,
                border: `1px solid ${controlBorder}`,
                '&:hover': {
                  bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.18 : 0.1)
                }
              }}
            >
              <ThemeIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Box
          sx={{
            borderRadius: 3.5,
            bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.14 : 0.08),
            border: `1px solid ${controlBorder}`,
            backdropFilter: 'blur(12px)'
          }}
        >
          <UserMenu variant="sidebar" />
        </Box>
      </Stack>
    </Box>
  );
}
