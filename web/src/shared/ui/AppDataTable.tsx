import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import type { ReactNode } from 'react';
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
  const theme = useTheme();

  return (
    <AppSurface
      title={title}
      description={description}
      action={action}
      icon={icon}
      sx={{ p: 0 }}
      contentSx={{ spacing: 0 }}
    >
      <TableContainer>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align}
                  sx={{
                    width: column.width,
                    px: { xs: 2, md: 2.5 },
                    py: 1.75,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 1)}`,
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ px: 2.5, py: 0 }}>
                  <Stack spacing={0.5} sx={{ alignItems: 'center', py: 5, textAlign: 'center' }}>
                    <Typography variant="subtitle1">{emptyTitle}</Typography>
                    {emptyDescription ? <Typography variant="body2" color="text.secondary">{emptyDescription}</Typography> : null}
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  hover
                  sx={{
                    '&:last-of-type td': {
                      borderBottom: 'none',
                    },
                  }}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.align}
                      sx={{
                        px: { xs: 2, md: 2.5 },
                        py: 2,
                        verticalAlign: 'middle',
                      }}
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
  const theme = useTheme();

  return (
    <Chip
      size="small"
      label={value ? trueLabel : falseLabel}
      color={value ? 'success' : 'default'}
      variant={value ? 'filled' : 'outlined'}
      sx={{
        height: 28,
        fontWeight: 600,
        borderRadius: 999,
        ...(value
          ? {
              boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.success.main, 0.08)}`,
            }
          : {
              borderColor: alpha(theme.palette.text.secondary, 0.2),
              color: 'text.primary',
              backgroundColor: alpha(theme.palette.background.default, 0.6),
            }),
      }}
    />
  );
}

export function AppTableActions({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
      {children}
    </Stack>
  );
}

export function AppTableIconAction({ label, icon, color = 'default', onClick }: AppTableIconActionProps) {
  const theme = useTheme();

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        color={color}
        aria-label={label}
        onClick={onClick}
        sx={{
          width: 34,
          height: 34,
          border: '1px solid',
          borderColor: color === 'error' ? 'error.light' : 'divider',
          backgroundColor: 'background.paper',
          '&:hover': {
            backgroundColor: color === 'error' ? alpha(theme.palette.error.main, 0.08) : alpha(theme.palette.primary.main, 0.06),
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export function AppInlineText({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Box>{primary}</Box>
      {secondary ? <Typography variant="body2" color="text.secondary">{secondary}</Typography> : null}
    </Stack>
  );
}
