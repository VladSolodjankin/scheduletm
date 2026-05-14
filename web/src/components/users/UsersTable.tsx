import { Box, ButtonBase, Chip, Stack, Typography, alpha, useTheme } from '@mui/material';
import type { ManagedUserItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppSurface } from '../../shared/ui/AppSurface';
import {
  AppBooleanBadge,
  AppTableActions,
  AppTableIconAction
} from '../../shared/ui/AppDataTable';
import { AppIcons } from '../../shared/ui/AppIcons';

type UsersTableProps = {
  emptyText: string;
  deactivateLabel: string;
  deleteLabel: string;
  resendInviteLabel: string;
  roleLabels: {
    admin: string;
    specialist: string;
    client: string;
  };
  users: ManagedUserItem[];
  onEdit: (item: ManagedUserItem) => void;
  onDeactivate: (item: ManagedUserItem) => void;
  onDelete: (item: ManagedUserItem) => void;
  onResendInvite: (item: ManagedUserItem) => void;
  isResendingInviteForUserId: number | null;
};

export function UsersTable({
  emptyText,
  deactivateLabel,
  deleteLabel,
  resendInviteLabel,
  roleLabels,
  users,
  onEdit,
  onDeactivate,
  onDelete,
  onResendInvite,
  isResendingInviteForUserId
}: UsersTableProps) {
  const theme = useTheme();

  const getRoleLabel = (item: ManagedUserItem) => {
    if (item.role === 'admin') {
      return roleLabels.admin;
    }
    if (item.role === 'client') {
      return roleLabels.client;
    }
    return roleLabels.specialist;
  };

  const getDisplayName = (item: ManagedUserItem) => [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || item.email;
  const getSecondaryLine = (item: ManagedUserItem) => [item.phone, item.telegramUsername].filter(Boolean).join(' • ');

  return (
    <AppSurface sx={{ p: 0 }} contentSx={{ spacing: 0 }}>
      {users.length === 0 ? (
        <Stack spacing={0.5} sx={{ alignItems: 'center', py: 5, px: 2.5, textAlign: 'center' }}>
          <Typography variant="subtitle1">{emptyText}</Typography>
        </Stack>
      ) : (
        users.map((item, index) => (
          <Box
            key={item.id}
            sx={{
              borderBottom: index === users.length - 1 ? 'none' : `${theme.spacing(0.125)} solid ${alpha(theme.palette.divider, 0.72)}`
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ alignItems: { md: 'center' }, px: { xs: 1, sm: 1.5 }, py: 1.25 }}
            >
              <ButtonBase
                onClick={() => onEdit(item)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 3,
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  px: { xs: 1, sm: 1.25 },
                  py: 1.25,
                  transition: theme.transitions.create(['background-color', 'transform'], {
                    duration: theme.transitions.duration.shorter
                  }),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.06),
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ width: '100%', alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'primary.main',
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.1)}`
                      }}
                    >
                      <AppIcons.users fontSize="small" />
                    </Box>

                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                        {getDisplayName(item)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {item.email}
                      </Typography>
                      {getSecondaryLine(item) ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {getSecondaryLine(item)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}
                  >
                    <Chip
                      size="small"
                      label={getRoleLabel(item)}
                      sx={{
                        height: 28,
                        fontWeight: 700,
                        borderRadius: 999,
                        backgroundColor: alpha(theme.palette.secondary.main, 0.12),
                        color: 'text.primary'
                      }}
                    />
                    <AppBooleanBadge value={item.isVerified} trueLabel="Verified" falseLabel="Not verified" />
                    <AppBooleanBadge value={item.isActive} trueLabel="Active" falseLabel="Inactive" />
                  </Stack>
                </Stack>
              </ButtonBase>

              <AppTableActions>
                {!item.isVerified ? (
                  <AppButton
                    size="small"
                    variant="text"
                    onClick={() => onResendInvite(item)}
                    isLoading={isResendingInviteForUserId === item.id}
                  >
                    {resendInviteLabel}
                  </AppButton>
                ) : null}
                {item.isActive ? (
                  <AppTableIconAction
                    label={deactivateLabel}
                    icon={<AppIcons.deactivate fontSize="small" />}
                    onClick={() => onDeactivate(item)}
                  />
                ) : null}
                <AppTableIconAction
                  label={deleteLabel}
                  color="error"
                  icon={<AppIcons.delete fontSize="small" />}
                  onClick={() => onDelete(item)}
                />
              </AppTableActions>
            </Stack>
          </Box>
        ))
      )}
    </AppSurface>
  );
}
