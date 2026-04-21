import {
  Avatar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography
} from '@mui/material';
import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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

export function UserMenu() {
  const { user, clearAuth } = useAuth();
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

  const logout = () => {
    closeMenu();
    clearAuth();
    navigate('/login');
  };

  return (
    <>
      <IconButton onClick={openMenu} aria-label={t('common.profileMenuAria')} sx={{ p: 0.25 }}>
        <Avatar src={user?.avatarUrl} alt={displayName} sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 600 }}>
          {!user?.avatarUrl ? initials : null}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.25, minWidth: 220 }}>
          <Stack spacing={0.25}>
            <Typography variant="subtitle2" noWrap>{displayName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
          </Stack>
        </Box>
        <Divider />

        <MenuItem onClick={goToSettings}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <AppIcons.settings fontSize="small" />
            <Typography variant="body2">{t('common.settings')}</Typography>
          </Stack>
        </MenuItem>

        <MenuItem onClick={logout}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <AppIcons.logout fontSize="small" />
            <Typography variant="body2">{t('common.logout')}</Typography>
          </Stack>
        </MenuItem>
      </Menu>
    </>
  );
}
