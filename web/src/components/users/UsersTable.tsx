import { Typography } from '@mui/material';
import type { ManagedUserItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppAvatar, AppList, AppListRow } from '../../shared/ui/AppList';
import { AppStatusBadge } from '../../shared/ui/AppStatus';

type UsersTableProps = {
  emptyText: string;
  editLabel: string;
  deactivateLabel: string;
  deleteLabel: string;
  resendInviteLabel: string;
  notVerifiedLabel: string;
  inactiveLabel: string;
  moreActionsLabel: string;
  roleLabels: {
    owner: string;
    productAdmin: string;
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
  editLabel,
  deactivateLabel,
  deleteLabel,
  resendInviteLabel,
  notVerifiedLabel,
  inactiveLabel,
  moreActionsLabel,
  roleLabels,
  users,
  onEdit,
  onDeactivate,
  onDelete,
  onResendInvite,
  isResendingInviteForUserId
}: UsersTableProps) {
  const getRoleLabel = (item: ManagedUserItem) => {
    switch (item.role) {
      case 'client':
        return roleLabels.client;
      case 'owner':
        return roleLabels.owner;
      case 'product_admin':
        return roleLabels.productAdmin;
      default:
        return roleLabels.specialist;
    }
  };

  const getDisplayName = (item: ManagedUserItem) => [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || item.email;

  return (
    <AppList>
      {users.length === 0 ? (
        <Typography variant="subtitle1" className="app-list__empty">{emptyText}</Typography>
      ) : users.map((item) => (
        <AppListRow
          key={item.id}
          testId={`managed-user-${item.id}`}
          muted={!item.isActive}
          media={<AppAvatar name={getDisplayName(item)} />}
          title={getDisplayName(item)}
          badges={(
            <>
              <AppStatusBadge label={getRoleLabel(item)} tone="neutral" />
              {!item.isVerified ? <AppStatusBadge label={notVerifiedLabel} tone="warning" /> : null}
              {!item.isActive ? <AppStatusBadge label={inactiveLabel} tone="neutral" /> : null}
            </>
          )}
          subtitle={[item.email, item.phone, item.telegramUsername].filter(Boolean).join(' · ')}
          onClick={() => onEdit(item)}
          mainLabel={`${editLabel}: ${getDisplayName(item)}`}
          trailing={!item.isVerified ? (
            <AppButton
              size="small"
              variant="text"
              onClick={() => onResendInvite(item)}
              isLoading={isResendingInviteForUserId === item.id}
            >
              {resendInviteLabel}
            </AppButton>
          ) : null}
          actionsLabel={moreActionsLabel}
          actions={[
            { key: 'edit', label: editLabel, icon: <AppIcons.edit fontSize="small" />, onClick: () => onEdit(item) },
            {
              key: 'deactivate',
              label: deactivateLabel,
              icon: <AppIcons.deactivate fontSize="small" />,
              hidden: !item.isActive,
              onClick: () => onDeactivate(item),
            },
            { key: 'delete', label: deleteLabel, icon: <AppIcons.delete fontSize="small" />, danger: true, onClick: () => onDelete(item) },
          ]}
        />
      ))}
    </AppList>
  );
}
