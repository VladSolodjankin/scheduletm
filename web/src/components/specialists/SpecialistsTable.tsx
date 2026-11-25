import { Switch, Typography } from '@mui/material';
import type { SpecialistManagementItem } from '../../shared/types/api';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppAvatar, AppList, AppListRow } from '../../shared/ui/AppList';
import { AppStatusBadge } from '../../shared/ui/AppStatus';

type SpecialistsTableProps = {
  emptyText: string;
  editLabel: string;
  deleteLabel: string;
  inactiveLabel: string;
  moreActionsLabel: string;
  timezoneLabel: string;
  specialists: SpecialistManagementItem[];
  onEdit: (item: SpecialistManagementItem) => void;
  onDelete: (item: SpecialistManagementItem) => void;
  onToggleActive: (item: SpecialistManagementItem, isActive: boolean) => void;
  toggleActiveLabel: string;
  canDelete: boolean;
};

export function SpecialistsTable({
  emptyText,
  editLabel,
  deleteLabel,
  inactiveLabel,
  moreActionsLabel,
  timezoneLabel,
  specialists,
  onEdit,
  onDelete,
  onToggleActive,
  toggleActiveLabel,
  canDelete,
}: SpecialistsTableProps) {
  const activeCount = specialists.filter((item) => item.isActive).length;

  return (
    <AppList>
      {specialists.length === 0 ? (
        <Typography variant="subtitle1" className="app-list__empty">{emptyText}</Typography>
      ) : specialists.map((item) => (
        <AppListRow
          key={item.id}
          muted={!item.isActive}
          media={<AppAvatar name={item.name} />}
          title={item.name}
          badges={item.isActive ? null : <AppStatusBadge label={inactiveLabel} tone="neutral" />}
          subtitle={[`${timezoneLabel}: ${item.timezone}`, item.code].filter(Boolean).join(' · ')}
          onClick={() => onEdit(item)}
          trailing={canDelete ? (
            <Switch
              checked={item.isActive}
              disabled={item.isActive && activeCount <= 1}
              onChange={(event) => onToggleActive(item, event.target.checked)}
              slotProps={{ input: { 'aria-label': `${toggleActiveLabel}: ${item.name}` } }}
            />
          ) : null}
          actionsLabel={moreActionsLabel}
          actions={canDelete ? [
            { key: 'edit', label: editLabel, icon: <AppIcons.edit fontSize="small" />, onClick: () => onEdit(item) },
            {
              key: 'delete',
              label: deleteLabel,
              icon: <AppIcons.delete fontSize="small" />,
              danger: true,
              disabled: specialists.length <= 1,
              onClick: () => onDelete(item),
            },
          ] : undefined}
        />
      ))}
    </AppList>
  );
}
