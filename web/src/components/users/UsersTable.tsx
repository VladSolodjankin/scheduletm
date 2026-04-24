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
  users: ManagedUserItem[];
  onAdd: () => void;
  onEdit: (item: ManagedUserItem) => void;
  onDelete: (item: ManagedUserItem) => void;
};

export function UsersTable({ title, emptyText, addLabel, editLabel, deleteLabel, users, onAdd, onEdit, onDelete }: UsersTableProps) {
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
              <TableCell>Email</TableCell>
              <TableCell>Имя</TableCell>
              <TableCell>Фамилия</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Активен</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!users.length && (
              <TableRow>
                <TableCell colSpan={6}>{emptyText}</TableCell>
              </TableRow>
            )}
            {users.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.email}</TableCell>
                <TableCell>{item.firstName}</TableCell>
                <TableCell>{item.lastName}</TableCell>
                <TableCell>{item.role}</TableCell>
                <TableCell>{item.isActive ? '✓' : '—'}</TableCell>
                <TableCell align="right">
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
