import { Typography } from '@mui/material';
import type { ManagedUserItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import {
  AppBooleanBadge,
  AppDataTable,
  AppInlineText,
  AppTableActions,
  AppTableIconAction
} from '../../shared/ui/AppDataTable';
import { AppIcons } from '../../shared/ui/AppIcons';

type UsersTableProps = {
  emptyText: string;
  editLabel: string;
  deactivateLabel: string;
  deleteLabel: string;
  resendInviteLabel: string;
  emailColumnLabel: string;
  firstNameColumnLabel: string;
  lastNameColumnLabel: string;
  roleColumnLabel: string;
  verifiedColumnLabel: string;
  activeColumnLabel: string;
  actionsColumnLabel: string;
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
  emailColumnLabel,
  firstNameColumnLabel,
  lastNameColumnLabel,
  roleColumnLabel,
  verifiedColumnLabel,
  activeColumnLabel,
  actionsColumnLabel,
  users,
  onEdit,
  onDeactivate,
  onDelete,
  onResendInvite,
  isResendingInviteForUserId
}: UsersTableProps) {
  return (
    <AppDataTable
      title=""
      icon={<AppIcons.users fontSize="small" />}
      columns={[
        {
          key: 'email',
          label: emailColumnLabel,
          render: (item) => (
            <AppInlineText
              primary={<Typography variant="subtitle2">{item.email}</Typography>}
              secondary={item.telegramUsername || undefined}
            />
          )
        },
        {
          key: 'firstName',
          label: firstNameColumnLabel,
          render: (item) => item.firstName
        },
        {
          key: 'lastName',
          label: lastNameColumnLabel,
          render: (item) => item.lastName
        },
        {
          key: 'role',
          label: roleColumnLabel,
          render: (item) => item.role
        },
        {
          key: 'verified',
          label: verifiedColumnLabel,
          render: (item) => (
            <AppBooleanBadge value={item.isVerified} trueLabel="Verified" falseLabel="Not verified" />
          )
        },
        {
          key: 'active',
          label: activeColumnLabel,
          render: (item) => (
            <AppBooleanBadge value={item.isActive} trueLabel="Active" falseLabel="Inactive" />
          )
        },
        {
          key: 'actions',
          label: actionsColumnLabel,
          align: 'right',
          width: 220,
          render: (item) => (
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
              <AppTableIconAction label={editLabel} icon={<AppIcons.edit fontSize="small" />} onClick={() => onEdit(item)} />
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
          )
        }
      ]}
      rows={users}
      getRowKey={(item) => item.id}
      emptyTitle={emptyText}
    />
  );
}
