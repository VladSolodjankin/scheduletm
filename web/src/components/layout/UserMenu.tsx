import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography
} from '@mui/material';
import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, authHeaders } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppIcons } from '../../shared/ui/AppIcons';

function toDisplayName(email: string, fullName?: string) {
  if (fullName?.trim()) {
    return fullName.trim();
  }

  const localPart = email.split('@')[0] ?? '';
  const normalized = localPart.replace(/[._-]+/g, ' ').trim();
  if (!normalized) {
    return email;
  }

  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toInitials(displayName: string) {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }

  return (words[0] ?? '').slice(0, 2).toUpperCase();
}

type UserMenuProps = {
  variant?: 'icon' | 'sidebar';
};

export function UserMenu({ variant = 'icon' }: UserMenuProps) {
  const { user, accessToken, clearAuth } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const displayName = useMemo(
    () => toDisplayName(user?.email ?? 'User', user?.fullName),
    [user?.email, user?.fullName]
  );

  const initials = useMemo(() => toInitials(displayName), [displayName]);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  const goToSettings = () => {
    closeMenu();
    navigate('/settings');
  };

  const logout = async () => {
    closeMenu();
    try {
      await apiClient.post('/api/auth/logout', {}, {
        headers: accessToken ? authHeaders(accessToken) : undefined
      });
    } catch {
      // Если logout API недоступен, локально все равно завершаем сессию.
    }
    clearAuth();
    navigate('/login');
  };

  const trigger = variant === 'sidebar' ? (
    <ButtonBase
      onClick={openMenu}
      aria-label={t('common.profileMenuAria')}
      className="app-user-menu__sidebar-trigger"
    >
      <Stack direction="row" className="app-user-menu__trigger-content">
        <Avatar src={user?.avatarUrl} alt={displayName} className="app-user-menu__avatar app-avatar--m">
          {!user?.avatarUrl ? initials : null}
        </Avatar>
        <Box className="app-user-menu__identity">
          <Typography variant="body2" className="app-user-menu__name" noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" className="app-user-menu__email" noWrap>
            {user?.email}
          </Typography>
        </Box>
        <AppIcons.settings fontSize="small" className="app-icon--s" color="action" />
      </Stack>
    </ButtonBase>
  ) : (
    <IconButton onClick={openMenu} aria-label={t('common.profileMenuAria')} className="app-user-menu__icon-trigger">
      <Avatar src={user?.avatarUrl} alt={displayName} className="app-user-menu__avatar app-avatar--s">
        {!user?.avatarUrl ? initials : null}
      </Avatar>
    </IconButton>
  );

  return (
    <>
      {trigger}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { className: 'app-user-menu__paper' } }}
      >
        <Box className="app-user-menu__summary">
          <Stack className="app-user-menu__summary-copy">
            <Typography variant="subtitle2" noWrap>{displayName}</Typography>
            <Typography variant="caption" className="app-user-menu__email" noWrap>
              {user?.email}
            </Typography>
          </Stack>
        </Box>
        <Divider />

        <MenuItem onClick={goToSettings}>
          <Stack direction="row" className="app-user-menu__menu-item-content">
            <AppIcons.settings fontSize="small" className="app-icon--s" />
            <Typography variant="body2">{t('common.settings')}</Typography>
          </Stack>
        </MenuItem>

        <MenuItem onClick={logout}>
          <Stack direction="row" className="app-user-menu__menu-item-content">
            <AppIcons.logout fontSize="small" className="app-icon--s" />
            <Typography variant="body2">{t('common.logout')}</Typography>
          </Stack>
        </MenuItem>
      </Menu>
    </>
  );
}
