import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import type { CSSProperties, ReactNode } from 'react';
import { AppSurface } from './AppSurface';

export type AppTableColumn<T> = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
  render: (item: T) => ReactNode;
};

type AppDataTableProps<T> = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  columns: AppTableColumn<T>[];
  rows: T[];
  getRowKey: (item: T) => string | number;
  emptyTitle: string;
  emptyDescription?: string;
};

type AppTableIconActionProps = {
  label: string;
  icon: ReactNode;
  color?: 'default' | 'primary' | 'error';
  onClick: () => void;
};

export function AppDataTable<T>({
  title,
  description,
  action,
  icon,
  columns,
  rows,
  getRowKey,
  emptyTitle,
  emptyDescription
}: AppDataTableProps<T>) {
  return (
    <AppSurface
      title={title}
      description={description}
      action={action}
      icon={icon}
      className="app-data-table__surface"
    >
      <TableContainer>
        <Table className="app-data-table__table">
          <TableHead>
            <TableRow>
              {columns.map((column) => {
                const cellStyle = column.width === undefined
                  ? undefined
                  : { '--app-table-column-width': typeof column.width === 'number' ? `${column.width}px` : column.width } as CSSProperties;
                return (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    className="app-data-table__cell app-data-table__head-cell"
                    style={cellStyle}
                  >
                    {column.label}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="app-data-table__empty">
                  <Box className="app-data-table__empty-copy">
                    <Typography variant="subtitle1">{emptyTitle}</Typography>
                    {emptyDescription ? <Typography variant="body2" color="text.secondary">{emptyDescription}</Typography> : null}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={getRowKey(row)} hover className="app-data-table__row">
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.align}
                      className="app-data-table__cell"
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </AppSurface>
  );
}

type AppBooleanBadgeProps = {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
};

export function AppBooleanBadge({ value, trueLabel, falseLabel }: AppBooleanBadgeProps) {
  return (
    <Chip
      size="small"
      label={value ? trueLabel : falseLabel}
      color={value ? 'success' : 'default'}
      variant={value ? 'filled' : 'outlined'}
      className={`app-badge ${value ? 'app-badge--success' : 'app-badge--neutral'}`}
    />
  );
}

export function AppTableActions({ children }: { children: ReactNode }) {
  return <Box className="app-table-actions">{children}</Box>;
}

export function AppTableIconAction({ label, icon, color = 'default', onClick }: AppTableIconActionProps) {
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        color={color}
        aria-label={label}
        onClick={onClick}
        className={`app-table-icon-action${color === 'error' ? ' app-table-icon-action--danger' : ''}`}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export function AppInlineText({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <Box className="app-inline-text">
      <Box>{primary}</Box>
      {secondary ? <Typography variant="body2" className="app-inline-text__secondary">{secondary}</Typography> : null}
    </Box>
  );
}
