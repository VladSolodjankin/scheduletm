import { Box, ButtonBase, Stack, Typography, alpha, useTheme } from '@mui/material';
import type { SpecialistManagementItem } from '../../shared/types/api';
import { AppSurface } from '../../shared/ui/AppSurface';
import {
  AppBooleanBadge,
  AppTableActions,
  AppTableIconAction
} from '../../shared/ui/AppDataTable';
import { AppIcons } from '../../shared/ui/AppIcons';

type SpecialistsTableProps = {
  emptyText: string;
  deleteLabel: string;
  timezoneLabel: string;
  specialists: SpecialistManagementItem[];
  onEdit: (item: SpecialistManagementItem) => void;
  onDelete: (item: SpecialistManagementItem) => void;
  canDelete: boolean;
};

export function SpecialistsTable({
  emptyText,
  deleteLabel,
  timezoneLabel,
  specialists,
  onEdit,
  onDelete,
  canDelete,
}: SpecialistsTableProps) {
  const theme = useTheme();

  return (
    <AppSurface sx={{ p: 0 }} contentSx={{ spacing: 0 }}>
      {specialists.length === 0 ? (
        <Stack spacing={0.5} sx={{ alignItems: 'center', py: 5, px: 2.5, textAlign: 'center' }}>
          <Typography variant="subtitle1">{emptyText}</Typography>
        </Stack>
      ) : (
        specialists.map((item, index) => (
          <Box
            key={item.id}
            sx={{
              borderBottom: index === specialists.length - 1 ? 'none' : `${theme.spacing(0.125)} solid ${alpha(theme.palette.divider, 0.72)}`
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
                      <AppIcons.specialists fontSize="small" />
                    </Box>

                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {timezoneLabel}: {item.timezone}
                      </Typography>
                      {item.code ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.code}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>

                  <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                    <AppBooleanBadge value={item.isActive} trueLabel="Active" falseLabel="Inactive" />
                  </Box>
                </Stack>
              </ButtonBase>

              {canDelete ? (
                <AppTableActions>
                  <AppTableIconAction
                    label={deleteLabel}
                    color="error"
                    icon={<AppIcons.delete fontSize="small" />}
                    onClick={() => onDelete(item)}
                  />
                </AppTableActions>
              ) : null}
            </Stack>
          </Box>
        ))
      )}
    </AppSurface>
  );
}
