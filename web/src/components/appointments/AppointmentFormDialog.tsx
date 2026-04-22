import {
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { AppointmentItem, AppointmentStatus, SpecialistItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import {
  AVAILABLE_TIMEZONES,
  BROWSER_TIMEZONE,
  buildStartEndIso,
  composeFormDateTime,
  createFormValuesFromAppointmentAt,
  EditFormState,
  splitLocalDateTime,
  STATUS_OPTIONS,
  addMinutesToDatetimeLocal,
  statusLabel,
} from './appointmentsUtils';

import type { TranslationKey } from '../../shared/i18n/dictionaries';

type Props = {
  t: (key: TranslationKey) => string;
  open: boolean;
  editingItem: AppointmentItem | null;
  specialists: SpecialistItem[];
  selectedSpecialistId: number | 'all';
  selectedSlotStepMin: number;
  isSubmittingForm: boolean;
  isCancellingAppointment: boolean;
  onClose: () => void;
  onCancel: () => Promise<void>;
  onSubmit: (payload: {
    specialistId: number;
    status: AppointmentStatus;
    meetingLink: string;
    notes: string;
    startIso: string;
    durationMin: number;
  }) => Promise<void>;
};

const EMPTY_FORM: EditFormState = {
  specialistId: '',
  startDate: '',
  startTime: '',
  endTime: '',
  status: 'new',
  meetingLink: '',
  notes: '',
};

export function AppointmentFormDialog({
  t,
  open,
  editingItem,
  specialists,
  selectedSpecialistId,
  selectedSlotStepMin,
  isSubmittingForm,
  isCancellingAppointment,
  onClose,
  onCancel,
  onSubmit,
}: Props) {
  const [showTimezoneSelect, setShowTimezoneSelect] = useState(false);
  const [formTimeZone, setFormTimeZone] = useState(BROWSER_TIMEZONE);

  const initialValues = useMemo(() => {
    const defaultSpecialistId = selectedSpecialistId === 'all' ? specialists[0]?.id : selectedSpecialistId;

    if (editingItem) {
      const times = createFormValuesFromAppointmentAt(
        editingItem.scheduledAt,
        editingItem.durationMin || selectedSlotStepMin,
        BROWSER_TIMEZONE,
      );

      return {
        specialistId: String(editingItem.specialistId),
        startDate: times.startDate,
        startTime: times.startTime,
        endTime: times.endTime,
        status: editingItem.status,
        meetingLink: editingItem.meetingLink,
        notes: editingItem.notes,
      } satisfies EditFormState;
    }

    const times = createFormValuesFromAppointmentAt(new Date().toISOString(), selectedSlotStepMin, BROWSER_TIMEZONE);

    return {
      specialistId: defaultSpecialistId ? String(defaultSpecialistId) : '',
      startDate: times.startDate,
      startTime: times.startTime,
      endTime: times.endTime,
      status: 'new',
      meetingLink: '',
      notes: '',
    } satisfies EditFormState;
  }, [editingItem, selectedSlotStepMin, selectedSpecialistId, specialists]);

  const { control, handleSubmit, reset, watch, setValue } = useForm<EditFormState>({
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(initialValues);
    setFormTimeZone(BROWSER_TIMEZONE);
    setShowTimezoneSelect(false);
  }, [initialValues, open, reset]);

  const startDateValue = watch('startDate');
  const startTimeValue = watch('startTime');

  useEffect(() => {
    if (!open || editingItem) {
      return;
    }

    const startAt = composeFormDateTime(startDateValue, startTimeValue);
    const nextEnd = splitLocalDateTime(addMinutesToDatetimeLocal(startAt, selectedSlotStepMin, formTimeZone));
    setValue('endTime', nextEnd.time, { shouldDirty: true });
  }, [editingItem, formTimeZone, open, selectedSlotStepMin, setValue, startDateValue, startTimeValue]);

  const submitForm = handleSubmit(async (form) => {
    const specialistId = Number(form.specialistId);

    if (!Number.isFinite(specialistId) || specialistId <= 0) {
      return;
    }

    const { startIso, endIso } = buildStartEndIso(form, formTimeZone);
    const durationMin = Math.max(selectedSlotStepMin, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));

    await onSubmit({
      specialistId,
      status: form.status,
      meetingLink: form.meetingLink,
      notes: form.notes,
      startIso,
      durationMin,
    });
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingItem ? t('appointments.editTitle') : t('appointments.createTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="text"
              size="small"
              onClick={() => setShowTimezoneSelect((prev) => !prev)}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              {showTimezoneSelect ? 'Hide custom timezone' : 'Use custom timezone'}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {`Current timezone: ${formTimeZone}`}
            </Typography>
          </Stack>
          <Collapse in={showTimezoneSelect}>
            <FormControl fullWidth>
              <InputLabel id="appointment-timezone-label">Timezone</InputLabel>
              <Select
                labelId="appointment-timezone-label"
                label="Timezone"
                value={formTimeZone}
                onChange={(event) => setFormTimeZone(String(event.target.value))}
              >
                {AVAILABLE_TIMEZONES.map((timeZone) => (
                  <MenuItem key={timeZone} value={timeZone}>{timeZone}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Collapse>
          <Controller
            name="specialistId"
            control={control}
            render={({ field }: any) => (
              <FormControl>
                <InputLabel id="specialist-label">{t('appointments.specialistFilter')}</InputLabel>
                <Select
                  labelId="specialist-label"
                  label={t('appointments.specialistFilter')}
                  value={field.value}
                  disabled={Boolean(editingItem)}
                  onChange={(event) => field.onChange(String(event.target.value))}
                >
                  {specialists.map((specialist) => (
                    <MenuItem key={specialist.id} value={String(specialist.id)}>{specialist.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="startDate"
            control={control}
            render={({ field }: any) => (
              <AppRhfTextField
                field={field}
                label="Start date"
                type="date"
              />
            )}
          />
          <Controller
            name="startTime"
            control={control}
            render={({ field }: any) => (
              <AppRhfTextField
                field={field}
                label="Start time"
                type="time"
                minutesStep={selectedSlotStepMin}
              />
            )}
          />
          <Controller
            name="endTime"
            control={control}
            render={({ field }: any) => (
              <AppRhfTextField
                field={field}
                label="End time"
                type="time"
                minutesStep={selectedSlotStepMin}
              />
            )}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }: any) => (
              <FormControl>
                <InputLabel id="status-label">{t('appointments.fields.status')}</InputLabel>
                <Select
                  labelId="status-label"
                  label={t('appointments.fields.status')}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value as AppointmentStatus)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="meetingLink"
            control={control}
            render={({ field }: any) => (
              <AppRhfTextField field={field} label={t('appointments.fields.meetingLink')} />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }: any) => (
              <AppRhfTextField field={field} label={t('appointments.fields.notes')} multiline minRows={3} />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {editingItem && (
          <AppButton color="error" onClick={onCancel} isLoading={isCancellingAppointment}>
            {t('appointments.cancelAction')}
          </AppButton>
        )}
        <Button onClick={onClose} disabled={isSubmittingForm || isCancellingAppointment}>{t('appointments.close')}</Button>
        <AppButton variant="contained" onClick={submitForm} isLoading={isSubmittingForm}>
          {t('appointments.save')}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}
