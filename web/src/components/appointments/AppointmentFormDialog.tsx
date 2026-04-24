import {
  Box,
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
import type { AppointmentItem, AppointmentStatus, ClientItem, SpecialistItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppRhfPhoneField, isValidPhoneValue } from '../../shared/ui/AppRhfPhoneField';
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

type AppointmentFormState = EditFormState & {
  clientId: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

type Props = {
  t: (key: TranslationKey) => string;
  open: boolean;
  editingItem: AppointmentItem | null;
  specialists: SpecialistItem[];
  clients: ClientItem[];
  selectedSpecialistId: number | 'all';
  selectedSlotStepMin: number;
  initialScheduledAtIso: string | null;
  isSubmittingForm: boolean;
  isCancellingAppointment: boolean;
  isMarkingPaid: boolean;
  isNotifyingClient: boolean;
  onClose: () => void;
  onCancel: () => Promise<void>;
  onMarkPaid: () => Promise<void>;
  onNotifyClient: () => Promise<void>;
  onSubmit: (payload: {
    specialistId: number;
    status: AppointmentStatus;
    meetingLink: string;
    notes: string;
    appointmentAt: string;
    appointmentEndAt: string;
    clientId?: number;
    username: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }) => Promise<void>;
};

const EMPTY_FORM: AppointmentFormState = {
  specialistId: '',
  clientId: '',
  startDate: '',
  startTime: '',
  endTime: '',
  status: 'new',
  meetingLink: '',
  notes: '',
  username: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
};

export function AppointmentFormDialog({
  t,
  open,
  editingItem,
  specialists,
  clients,
  selectedSpecialistId,
  selectedSlotStepMin,
  initialScheduledAtIso,
  isSubmittingForm,
  isCancellingAppointment,
  isMarkingPaid,
  isNotifyingClient,
  onClose,
  onCancel,
  onMarkPaid,
  onNotifyClient,
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
        clientId: String(editingItem.client?.id ?? ''),
        startDate: times.startDate,
        startTime: times.startTime,
        endTime: times.endTime,
        status: editingItem.status,
        meetingLink: editingItem.meetingLink,
        notes: editingItem.notes,
        username: editingItem.client?.username ?? '',
        firstName: editingItem.client?.firstName ?? '',
        lastName: editingItem.client?.lastName ?? '',
        phone: editingItem.client?.phone ?? '',
        email: editingItem.client?.email ?? '',
      } satisfies AppointmentFormState;
    }

    const times = createFormValuesFromAppointmentAt(
      initialScheduledAtIso ?? new Date().toISOString(),
      selectedSlotStepMin,
      BROWSER_TIMEZONE,
    );

    return {
      specialistId: defaultSpecialistId ? String(defaultSpecialistId) : '',
      clientId: '',
      startDate: times.startDate,
      startTime: times.startTime,
      endTime: times.endTime,
      status: 'new',
      meetingLink: '',
      notes: '',
      username: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
    } satisfies AppointmentFormState;
  }, [editingItem, initialScheduledAtIso, selectedSlotStepMin, selectedSpecialistId, specialists]);

  const { control, handleSubmit, reset, watch, setValue } = useForm<AppointmentFormState>({
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

  const selectedClientId = watch('clientId');

  useEffect(() => {
    const selectedClient = clients.find((item) => String(item.id) === selectedClientId);
    if (!selectedClient) {
      return;
    }

    setValue('username', selectedClient.username, { shouldDirty: true });
    setValue('firstName', selectedClient.firstName, { shouldDirty: true });
    setValue('lastName', selectedClient.lastName, { shouldDirty: true });
    setValue('phone', selectedClient.phone, { shouldDirty: true });
    setValue('email', selectedClient.email, { shouldDirty: true });
  }, [clients, selectedClientId, setValue]);

  const startDateValue = watch('startDate');
  const startTimeValue = watch('startTime');

  useEffect(() => {
    if (!open || editingItem || !startDateValue || !startTimeValue) {
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

    await onSubmit({
      specialistId,
      status: form.status,
      meetingLink: form.meetingLink,
      notes: form.notes,
      appointmentAt: startIso,
      appointmentEndAt: endIso,
      clientId: form.clientId ? Number(form.clientId) : undefined,
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email,
    });
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
              <FormControl fullWidth>
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
            name="clientId"
            control={control}
            render={({ field }: any) => (
              <FormControl fullWidth>
                <InputLabel id="client-label">Client</InputLabel>
                <Select
                  labelId="client-label"
                  label="Client"
                  value={field.value}
                  onChange={(event) => field.onChange(String(event.target.value))}
                >
                  <MenuItem value="">New client</MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={String(client.id)}>{`${client.firstName} ${client.lastName}`.trim()}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <Controller name="startDate" control={control} render={({ field }: any) => <AppRhfTextField field={field} label="Start date" type="date" />} />
            <Controller
              name="startTime"
              control={control}
              render={({ field }: any) => <AppRhfTextField field={field} label="Start time" type="time" minutesStep={selectedSlotStepMin} />}
            />
            <Controller
              name="endTime"
              control={control}
              render={({ field }: any) => <AppRhfTextField field={field} label="End time" type="time" minutesStep={selectedSlotStepMin} />}
            />
            <Controller
              name="status"
              control={control}
              render={({ field }: any) => (
                <FormControl fullWidth>
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
            <Controller name="firstName" control={control} render={({ field }: any) => <AppRhfTextField field={field} label="First name" />} />
            <Controller name="lastName" control={control} render={({ field }: any) => <AppRhfTextField field={field} label="Last name" />} />
            <Controller name="phone" control={control}
              rules={{
                validate: (value) => isValidPhoneValue(value) || 'Invalid phone number',
              }}
              render={({ field, fieldState }) => (
                <AppRhfPhoneField
                  field={field}
                  label="Phone"
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller name="email" control={control} render={({ field }: any) => <AppRhfTextField field={field} label="Email" />} />
            <Controller
              name="username"
              control={control}
              render={({ field }: any) => <AppRhfTextField field={field} label="Telegram username" />}
            />
            <Controller
              name="meetingLink"
              control={control}
              render={({ field }: any) => (
                <AppRhfTextField
                  field={field}
                  label={t('appointments.fields.meetingLink')}
                  sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}
                />
              )}
            />
            <Controller
              name="notes"
              control={control}
              render={({ field }: any) => (
                <AppRhfTextField
                  field={field}
                  label={t('appointments.fields.notes')}
                  multiline
                  minRows={3}
                  sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}
                />
              )}
            />
          </Box>
          {editingItem && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {editingItem.paymentStatus === 'paid'
                  ? t('appointments.paymentStatusPaid')
                  : t('appointments.paymentStatusUnpaid')}
              </Typography>
              <Typography variant="subtitle2">{t('appointments.auditTitle')}</Typography>
              <Stack spacing={0.5}>
                {(editingItem.events ?? []).slice(0, 6).map((event, index) => {
                  const eventLabel = event.action === 'cancel'
                    ? t('appointments.eventCancel')
                    : event.action === 'reschedule'
                      ? t('appointments.eventReschedule')
                      : event.action === 'mark-paid'
                        ? t('appointments.eventMarkPaid')
                        : t('appointments.eventNotify');

                  return (
                    <Typography key={`${event.createdAt}-${index}`} variant="caption" color="text.secondary">
                      {`${eventLabel} · ${new Date(event.createdAt).toLocaleString()}`}
                    </Typography>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {editingItem && (
          <AppButton color="error" onClick={onCancel} isLoading={isCancellingAppointment}>
            {t('appointments.cancelAction')}
          </AppButton>
        )}
        {editingItem && (
          <AppButton onClick={onMarkPaid} isLoading={isMarkingPaid}>
            {t('appointments.markPaidAction')}
          </AppButton>
        )}
        {editingItem && (
          <AppButton onClick={onNotifyClient} isLoading={isNotifyingClient}>
            {t('appointments.notifyAction')}
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
