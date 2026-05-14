import { Typography } from '@mui/material';
import type { SpecialistManagementItem } from '../../shared/types/api';
import {
  AppBooleanBadge,
  AppDataTable,
  AppInlineText,
  AppTableActions,
  AppTableIconAction
} from '../../shared/ui/AppDataTable';
import { AppIcons } from '../../shared/ui/AppIcons';

type SpecialistsTableProps = {
  emptyText: string;
  editLabel: string;
  deleteLabel: string;
  columns: {
    name: string;
    timezone: string;
    active: string;
    actions: string;
  };
  specialists: SpecialistManagementItem[];
  onEdit: (item: SpecialistManagementItem) => void;
  onDelete: (item: SpecialistManagementItem) => void;
  canDelete: boolean;
};

export function SpecialistsTable({
  emptyText,
  editLabel,
  deleteLabel,
  columns,
  specialists,
  onEdit,
  onDelete,
  canDelete,
}: SpecialistsTableProps) {
  return (
    <AppDataTable
      title=""
      icon={<AppIcons.specialists fontSize="small" />}
      columns={[
        {
          key: 'name',
          label: columns.name,
          render: (item) => (
            <AppInlineText
              primary={<Typography variant="subtitle2">{item.name}</Typography>}
              secondary={item.code || undefined}
            />
          )
        },
        {
          key: 'timezone',
          label: columns.timezone,
          render: (item) => item.timezone
        },
        {
          key: 'active',
          label: columns.active,
          render: (item) => <AppBooleanBadge value={item.isActive} trueLabel="Active" falseLabel="Inactive" />
        },
        {
          key: 'actions',
          label: columns.actions,
          align: 'right',
          width: 140,
          render: (item) => (
            <AppTableActions>
              <AppTableIconAction label={editLabel} icon={<AppIcons.edit fontSize="small" />} onClick={() => onEdit(item)} />
              {canDelete ? (
                <AppTableIconAction
                  label={deleteLabel}
                  color="error"
                  icon={<AppIcons.delete fontSize="small" />}
                  onClick={() => onDelete(item)}
                />
              ) : null}
            </AppTableActions>
          )
        }
      ]}
      rows={specialists}
      getRowKey={(item) => item.id}
      emptyTitle={emptyText}
    />
  );
}
