import { useState } from 'react';
import {
  Box,
  ButtonBase,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';

import type { ScheduleException, ScheduleExceptionCreatePayload, ScheduleExceptionType } from '../../shared/types/api';
import type { ScheduleExceptionsCopy } from '../SettingsCard.types';
import { AppSurface } from '../../shared/ui/AppSurface';
import { AppButton } from '../../shared/ui/AppButton';
import { AppDialog } from '../../shared/ui/AppDialog';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppTableActions, AppTableIconAction } from '../../shared/ui/AppDataTable';

type Props = {
  copy: ScheduleExceptionsCopy;
  items: ScheduleException[];
  isSaving: boolean;
  onCreate: (payload: ScheduleExceptionCreatePayload) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
};

const WHOLE_DAY_TYPES: ScheduleExceptionType[] = ['day_off', 'vacation'];
const PARTIAL_DAY_TYPES: ScheduleExceptionType[] = ['interval', 'break'];

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return undefined;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatRange(copy: ScheduleExceptionsCopy, item: ScheduleException): string {
  if (item.startsAtMinute === null || item.endsAtMinute === null) {
    return copy.wholeDayLabel;
  }
  return `${minutesToTime(item.startsAtMinute)}–${minutesToTime(item.endsAtMinute)}`;
}

export function ScheduleExceptionsTab({ copy, items, isSaving, onCreate, onDelete }: Props) {
  const theme = useTheme();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [date, setDate] = useState('');
  const [type, setType] = useState<ScheduleExceptionType>('day_off');
  const [startsAt, setStartsAt] = useState('09:00');
  const [endsAt, setEndsAt] = useState('10:00');
  const [note, setNote] = useState('');

  const isPartialDay = PARTIAL_DAY_TYPES.includes(type);

  const resetForm = () => {
    setDate('');
    setType('day_off');
    setStartsAt('09:00');
    setEndsAt('10:00');
    setNote('');
  };

  const closeDialog = () => {
    if (isSaving) {
      return;
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const submit = async () => {
    if (!date) {
      return;
    }

    await onCreate({
      date,
      type,
      note: note.trim() || undefined,
      ...(isPartialDay ? { startsAtMinute: timeToMinutes(startsAt), endsAtMinute: timeToMinutes(endsAt) } : {}),
    });
    setIsDialogOpen(false);
    resetForm();
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{copy.title}</Typography>
        <AppButton size="small" startIcon={<AppIcons.add />} onClick={() => setIsDialogOpen(true)}>
          {copy.addButton}
        </AppButton>
      </Stack>

      <AppSurface sx={{ p: 0 }} contentSx={{ spacing: 0 }}>
        {items.length === 0 ? (
          <Stack spacing={0.5} sx={{ alignItems: 'center', py: 5, px: 2.5, textAlign: 'center' }}>
            <Typography variant="subtitle1">{copy.empty}</Typography>
          </Stack>
        ) : (
          items.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                borderBottom: index === items.length - 1 ? 'none' : `${theme.spacing(0.125)} solid ${alpha(theme.palette.divider, 0.72)}`,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: { xs: 1, sm: 1.5 }, py: 1.25 }}>
                <ButtonBase
                  disabled
                  sx={{ flex: 1, minWidth: 0, borderRadius: 3, textAlign: 'left', justifyContent: 'flex-start', px: { xs: 1, sm: 1.25 }, py: 1.25 }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center',
                        color: 'primary.main', backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.1)}`,
                      }}
                    >
                      <AppIcons.calendar fontSize="small" />
                    </Box>
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                        {item.date} · {copy.types[item.type]}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {formatRange(copy, item)}
                      </Typography>
                      {item.note ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.note}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </ButtonBase>

                <AppTableActions>
                  <AppTableIconAction
                    label={copy.deleteLabel}
                    color="error"
                    icon={<AppIcons.delete fontSize="small" />}
                    onClick={() => void onDelete(item.id)}
                  />
                </AppTableActions>
              </Stack>
            </Box>
          ))
        )}
      </AppSurface>

      <AppDialog
        open={isDialogOpen}
        onClose={closeDialog}
        title={copy.dialogTitle}
        description={isPartialDay ? undefined : copy.wholeDayHint}
        actions={(
          <>
            <AppButton variant="text" onClick={closeDialog} disabled={isSaving}>{copy.cancel}</AppButton>
            <AppButton onClick={() => void submit()} isLoading={isSaving} disabled={!date}>{copy.save}</AppButton>
          </>
        )}
      >
        <Stack spacing={2}>
          <TextField
            label={copy.date}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <FormControl fullWidth>
            <InputLabel>{copy.type}</InputLabel>
            <Select
              label={copy.type}
              value={type}
              onChange={(event) => setType(event.target.value as ScheduleExceptionType)}
            >
              {[...WHOLE_DAY_TYPES, ...PARTIAL_DAY_TYPES].map((option) => (
                <MenuItem key={option} value={option}>{copy.types[option]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {isPartialDay ? (
            <Stack direction="row" spacing={2}>
              <TextField
                label={copy.startsAt}
                type="time"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label={copy.endsAt}
                type="time"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
          ) : null}

          <TextField
            label={copy.note}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </AppDialog>
    </Stack>
  );
}
