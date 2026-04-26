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
import type { SpecialistManagementItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';

type SpecialistsTableProps = {
  title: string;
  emptyText: string;
  addLabel: string;
  editLabel: string;
  deleteLabel: string;
  columns: {
    name: string;
    timezone: string;
    active: string;
    actions: string;
  };
  specialists: SpecialistManagementItem[];
  onAdd: () => void;
  onEdit: (item: SpecialistManagementItem) => void;
  onDelete: (item: SpecialistManagementItem) => void;
  canAdd: boolean;
  canDelete: boolean;
};

export function SpecialistsTable({
  title,
  emptyText,
  addLabel,
  editLabel,
  deleteLabel,
  columns,
  specialists,
  onAdd,
  onEdit,
  onDelete,
  canAdd,
  canDelete,
}: SpecialistsTableProps) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">{title}</Typography>
        {canAdd ? <AppButton size="small" onClick={onAdd} startIcon={<AppIcons.add />}>{addLabel}</AppButton> : <span />}
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{columns.name}</TableCell>
              <TableCell>{columns.timezone}</TableCell>
              <TableCell>{columns.active}</TableCell>
              <TableCell align="right">{columns.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!specialists.length && (
              <TableRow>
                <TableCell colSpan={4}>{emptyText}</TableCell>
              </TableRow>
            )}

            {specialists.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.timezone}</TableCell>
                <TableCell>{item.isActive ? '✓' : '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" aria-label={editLabel} onClick={() => onEdit(item)}>
                    <AppIcons.edit fontSize="small" />
                  </IconButton>
                  {canDelete && (
                    <IconButton size="small" aria-label={deleteLabel} color="error" onClick={() => onDelete(item)}>
                      <AppIcons.delete fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
