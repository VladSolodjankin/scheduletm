import {
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ManagedUserItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';

type UsersTableProps = {
  title: string;
  emptyText: string;
  addLabel: string;
  editLabel: string;
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
  onAdd: () => void;
  onEdit: (item: ManagedUserItem) => void;
  onDelete: (item: ManagedUserItem) => void;
  onResendInvite: (item: ManagedUserItem) => void;
  isResendingInviteForUserId: number | null;
};

export function UsersTable({
  title,
  emptyText,
  addLabel,
  editLabel,
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
  onAdd,
  onEdit,
  onDelete,
  onResendInvite,
  isResendingInviteForUserId
}: UsersTableProps) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{title}</Typography>
        <AppButton size="small" onClick={onAdd} startIcon={<AppIcons.add />}>{addLabel}</AppButton>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{emailColumnLabel}</TableCell>
              <TableCell>{firstNameColumnLabel}</TableCell>
              <TableCell>{lastNameColumnLabel}</TableCell>
              <TableCell>{roleColumnLabel}</TableCell>
              <TableCell>{verifiedColumnLabel}</TableCell>
              <TableCell>{activeColumnLabel}</TableCell>
              <TableCell align="right">{actionsColumnLabel}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!users.length && (
              <TableRow>
                <TableCell colSpan={7}>{emptyText}</TableCell>
              </TableRow>
            )}
            {users.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.email}</TableCell>
                <TableCell>{item.firstName}</TableCell>
                <TableCell>{item.lastName}</TableCell>
                <TableCell>{item.role}</TableCell>
                <TableCell>{item.isVerified ? '✓' : '—'}</TableCell>
                <TableCell>{item.isActive ? '✓' : '—'}</TableCell>
                <TableCell align="right">
                  {!item.isVerified && (
                    <AppButton
                      size="small"
                      variant="text"
                      onClick={() => onResendInvite(item)}
                      isLoading={isResendingInviteForUserId === item.id}
                      sx={{ mr: 0.5 }}
                    >
                      {resendInviteLabel}
                    </AppButton>
                  )}
                  <IconButton size="small" aria-label={editLabel} onClick={() => onEdit(item)}>
                    <AppIcons.edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label={deleteLabel} color="error" onClick={() => onDelete(item)}>
                    <AppIcons.delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
