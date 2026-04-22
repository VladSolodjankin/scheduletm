import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { AppointmentItem, AppointmentListResponse, AppointmentStatus, SpecialistItem } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppPage } from '../shared/ui/AppPage';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';

type EditFormState = {
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
};

type CalendarViewMode = 'day' | 'week';

const STATUS_OPTIONS: AppointmentStatus[] = ['new', 'confirmed', 'cancelled'];
const DEFAULT_SLOT_STEP_MIN = 30;
const SLOT_ROWS = Array.from({ length: 48 }, (_, index) => index * 30);
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function getDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '00';

  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  };
}

function toDatetimeLocal(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = getDateTimeParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function fromDatetimeLocal(value: string, timeZone: string): string {
  const [datePart, timePart] = value.split('T');

  if (!datePart || !timePart) {
    return new Date(value).toISOString();
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const targetMinutes = (((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute;

  let guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 3; i += 1) {
    const guessDate = new Date(guessUtcMs);
    const guessParts = getDateTimeParts(guessDate, timeZone);
    const guessMinutes = (((guessParts.year * 12 + guessParts.month) * 31 + guessParts.day) * 24 + guessParts.hour) * 60 + guessParts.minute;
    const diffMinutes = guessMinutes - targetMinutes;

    if (diffMinutes === 0) {
      break;
    }

    guessUtcMs -= diffMinutes * 60 * 1000;
  }

  return new Date(guessUtcMs).toISOString();
}

function toDateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = getDateTimeParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function toTimeKeyInTimezone(date: Date, timeZone: string): string {
  const parts = getDateTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function createDatetimeLocal(dateKey: string, hour: number, minute = 0): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateKey}T${pad(hour)}:${pad(minute)}`;
}

function addMinutesToDatetimeLocal(value: string, minutesToAdd: number, timeZone: string): string {
  const iso = fromDatetimeLocal(value, timeZone);
  return toDatetimeLocal(new Date(new Date(iso).getTime() + minutesToAdd * 60_000).toISOString(), timeZone);
}

function diffMinutesBetweenLocalDateTimes(startValue: string, endValue: string, timeZone: string): number {
  const startIso = fromDatetimeLocal(startValue, timeZone);
  const endIso = fromDatetimeLocal(endValue, timeZone);
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round(diffMs / 60_000);
}

function getUtcNowByTimeZone(timeZone: string): Date {
  const now = new Date();
  const nowLocal = toDatetimeLocal(now.toISOString(), timeZone);
  const todayKey = nowLocal.slice(0, 10);

  return new Date(fromDatetimeLocal(`${todayKey}T00:00`, timeZone));
}

function formatLocalDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(undefined, options);
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: AppointmentStatus): string {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'cancelled') return 'cancelled';
  return 'new';
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function weekStart(date: Date): Date {
  const base = startOfDay(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function AppointmentsContainer() {
  const { t } = useI18n();
  const { accessToken, user } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [busySlots, setBusySlots] = useState<AppointmentListResponse['busySlots']>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | 'all'>('all');
  const displayTimeZone = BROWSER_TIMEZONE;

  const [focusDate, setFocusDate] = useState(() => startOfDay(getUtcNowByTimeZone(displayTimeZone)));
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);

  const canManageAll = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin;
  const selectedSpecialist = selectedSpecialistId === 'all'
    ? null
    : specialists.find((item) => item.id === selectedSpecialistId) ?? null;
  const selectedSlotStepMin = selectedSpecialist?.slotStepMin ?? DEFAULT_SLOT_STEP_MIN;

  const initialStartAt = toDatetimeLocal(new Date().toISOString(), displayTimeZone);
  const initialFormValues: EditFormState = {
    startAt: initialStartAt,
    endAt: addMinutesToDatetimeLocal(initialStartAt, selectedSlotStepMin, displayTimeZone),
    status: 'new',
    meetingLink: '',
    notes: '',
  };

  const { control, handleSubmit, reset, watch, setValue } = useForm<EditFormState>({
    defaultValues: initialFormValues,
  });

  const startAtValue = watch('startAt');

  useEffect(() => {
    if (!isCreateOpen || editingItem) {
      return;
    }

    const nextEnd = addMinutesToDatetimeLocal(startAtValue, selectedSlotStepMin, displayTimeZone);
    setValue('endAt', nextEnd, { shouldDirty: true });
  }, [displayTimeZone, editingItem, isCreateOpen, selectedSlotStepMin, setValue, startAtValue]);

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [startOfDay(focusDate)];
    }

    const start = weekStart(focusDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [focusDate, viewMode]);

  const appointmentsByCell = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();

    for (const item of appointments) {
      const date = new Date(item.scheduledAt);
      const dayKey = toDateKeyInTimezone(date, displayTimeZone);
      const key = `${dayKey}:${toTimeKeyInTimezone(date, displayTimeZone)}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }

    map.forEach((list) => {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    });

    return map;
  }, [appointments, displayTimeZone]);

  const busySlotsByCell = useMemo(() => {
    const map = new Map<string, AppointmentListResponse['busySlots']>();

    for (const slot of busySlots) {
      const date = new Date(slot.scheduledAt);
      const dayKey = toDateKeyInTimezone(date, displayTimeZone);
      const key = `${dayKey}:${toTimeKeyInTimezone(date, displayTimeZone)}`;
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }

    return map;
  }, [busySlots, displayTimeZone]);

  function getGridDayKey(day: Date) {
    const noon = new Date(day);
    noon.setHours(12, 0, 0, 0);
    return toDateKeyInTimezone(noon, displayTimeZone);
  }

  function getVisibleRange() {
    const firstDay = visibleDays[0] ?? startOfDay(new Date());
    const lastDay = visibleDays[visibleDays.length - 1] ?? firstDay;
    const firstDayKey = getGridDayKey(firstDay);
    const lastDayKey = getGridDayKey(lastDay);

    return {
      from: fromDatetimeLocal(`${firstDayKey}T00:00`, displayTimeZone),
      to: fromDatetimeLocal(`${lastDayKey}T23:59`, displayTimeZone),
    };
  }

  const loadAppointments = async (nextSpecialistId: number | 'all' = selectedSpecialistId) => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);

    try {
      const { from, to } = getVisibleRange();
      const response = await apiClient.get<AppointmentListResponse>('/api/appointments', {
        headers: authHeaders(accessToken),
        params: {
          from,
          to,
          ...(nextSpecialistId === 'all' ? {} : { specialistId: nextSpecialistId }),
        },
      });

      setAppointments(response.data.appointments);
      setSpecialists(response.data.specialists);
      setBusySlots(response.data.busySlots ?? []);
      setError('');
    } catch {
      setError('Unable to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments(selectedSpecialistId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, focusDate, viewMode, selectedSpecialistId]);

  const openCreate = (targetDateKey: string, hour: number, minute = 0) => {
    const specialistId = selectedSpecialistId === 'all'
      ? specialists[0]?.id
      : selectedSpecialistId;

    if (!specialistId) {
      setError('Create at least one specialist first');
      return;
    }

    const startAt = createDatetimeLocal(targetDateKey, hour, minute);

    reset({
      startAt,
      endAt: addMinutesToDatetimeLocal(startAt, selectedSlotStepMin, displayTimeZone),
      status: 'new',
      meetingLink: '',
      notes: '',
    });
    setEditingItem(null);
    setIsCreateOpen(true);
  };

  const submitForm = async (form: EditFormState) => {
    if (!accessToken) {
      return;
    }

    const specialistId = selectedSpecialistId === 'all'
      ? specialists[0]?.id
      : selectedSpecialistId;

    if (!specialistId) {
      setError('Specialist is required');
      return;
    }

    const durationMin = Math.max(
      selectedSlotStepMin,
      diffMinutesBetweenLocalDateTimes(form.startAt, form.endAt, displayTimeZone),
    );

    try {
      if (editingItem) {
        await apiClient.patch(`/api/appointments/${editingItem.id}`, {
          scheduledAt: fromDatetimeLocal(form.startAt, displayTimeZone),
          durationMin,
          status: form.status,
          meetingLink: form.meetingLink,
          notes: form.notes,
        }, {
          headers: authHeaders(accessToken),
        });
      } else {
        await apiClient.post('/api/appointments', {
          specialistId,
          scheduledAt: fromDatetimeLocal(form.startAt, displayTimeZone),
          durationMin,
          status: form.status,
          meetingLink: form.meetingLink,
          notes: form.notes,
        }, {
          headers: authHeaders(accessToken),
        });
      }

      setIsCreateOpen(false);
      await loadAppointments(selectedSpecialistId);
    } catch {
      setError('Unable to save appointment');
    }
  };

  const openEdit = (item: AppointmentItem) => {
    const startAt = toDatetimeLocal(item.scheduledAt, displayTimeZone);

    setEditingItem(item);
    reset({
      startAt,
      endAt: addMinutesToDatetimeLocal(startAt, item.durationMin || selectedSlotStepMin, displayTimeZone),
      status: item.status,
      meetingLink: item.meetingLink,
      notes: item.notes,
    });
    setIsCreateOpen(true);
  };

  const cancelAppointment = async () => {
    if (!editingItem || !accessToken) {
      return;
    }

    try {
      await apiClient.post(`/api/appointments/${editingItem.id}/cancel`, {}, {
        headers: authHeaders(accessToken),
      });

      setIsCreateOpen(false);
      await loadAppointments(selectedSpecialistId);
    } catch {
      setError('Unable to cancel appointment');
    }
  };

  const moveAppointment = async (appointmentId: number, targetDayKey: string, targetHour: number, targetMinute: number) => {
    if (!accessToken) {
      return;
    }

    const current = appointments.find((item) => item.id === appointmentId);

    if (!current) {
      return;
    }

    const nextIso = fromDatetimeLocal(
      createDatetimeLocal(targetDayKey, targetHour, targetMinute),
      displayTimeZone,
    );

    try {
      await apiClient.post(`/api/appointments/${appointmentId}/reschedule`, {
        scheduledAt: nextIso,
      }, {
        headers: authHeaders(accessToken),
      });

      await loadAppointments(selectedSpecialistId);
      setError('');
    } catch {
      setError('Unable to reschedule appointment');
    }
  };

  const movePeriod = (direction: -1 | 1) => {
    const delta = viewMode === 'day' ? direction : direction * 7;
    setFocusDate((prev) => addDays(prev, delta));
  };

  return (
    <AppPage
      title={t('appointments.pageTitle')}
      subtitle={t('appointments.pageSubtitle')}
    >
      {error && (
        <Box sx={{ mb: 2, maxWidth: 720 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      <Stack spacing={2}>
        {canManageAll && (
          <FormControl sx={{ maxWidth: 360 }} size="small">
            <InputLabel id="specialist-filter">{t('appointments.specialistFilter')}</InputLabel>
            <Select
              labelId="specialist-filter"
              label={t('appointments.specialistFilter')}
              value={selectedSpecialistId}
              onChange={(event) => {
                const raw = event.target.value;
                setSelectedSpecialistId(raw === 'all' ? 'all' : Number(raw));
              }}
            >
              <MenuItem value="all">{t('appointments.allSpecialists')}</MenuItem>
              {specialists.map((specialist) => (
                <MenuItem key={specialist.id} value={specialist.id}>{specialist.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => movePeriod(-1)}>{'<'}</Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setFocusDate(startOfDay(new Date()))}
            >
              {t('appointments.today')}
            </Button>
            <Button size="small" variant="outlined" onClick={() => movePeriod(1)}>{'>'}</Button>
          </Stack>

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {viewMode === 'week'
              ? `${formatLocalDate(visibleDays[0])} — ${formatLocalDate(visibleDays[visibleDays.length - 1])}`
              : formatLocalDate(visibleDays[0])}
          </Typography>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_, nextMode: CalendarViewMode | null) => {
              if (nextMode) {
                setViewMode(nextMode);
              }
            }}
          >
            <ToggleButton value="day">{t('appointments.viewDay')}</ToggleButton>
            <ToggleButton value="week">{t('appointments.viewWeek')}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Typography variant="body2" color="text.secondary">{t('appointments.dragHint')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {selectedSpecialist
            ? `Displayed in your browser timezone: ${BROWSER_TIMEZONE}. Specialist timezone: ${selectedSpecialist.timezone}. Slot step: ${selectedSlotStepMin} min.`
            : `Displayed in your browser timezone: ${BROWSER_TIMEZONE}. Slot step: ${DEFAULT_SLOT_STEP_MIN} min.`}
        </Typography>

        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `72px repeat(${visibleDays.length}, minmax(180px, 1fr))`, minWidth: viewMode === 'week' ? 1100 : 560 }}>
            <Box sx={{ borderRight: 1, borderColor: 'divider', p: 1, bgcolor: 'background.default' }} />
            {visibleDays.map((day) => (
              <Box
                key={day.toISOString()}
                sx={{
                  borderRight: 1,
                  borderColor: 'divider',
                  p: 1,
                  bgcolor: getGridDayKey(day) === toDateKeyInTimezone(new Date(), displayTimeZone) ? 'action.selected' : 'background.default',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatLocalDate(day, { weekday: 'short' })}
                </Typography>
                <Typography variant="caption" color="text.secondary">{formatLocalDate(day)}</Typography>
              </Box>
            ))}

            {SLOT_ROWS.map((totalMinute) => {
              const hour = Math.floor(totalMinute / 60);
              const minute = totalMinute % 60;

              return (
                <Fragment key={`row-${hour}-${minute}`}>
                  <Box
                    sx={{
                      borderTop: 1,
                      borderRight: 1,
                      borderColor: 'divider',
                      px: 1,
                      py: 1,
                      bgcolor: 'background.default',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                    </Typography>
                  </Box>

                  {visibleDays.map((day) => {
                    const dayKey = getGridDayKey(day);
                    const timeKey = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    const key = `${dayKey}:${timeKey}`;
                    const items = appointmentsByCell.get(key) ?? [];
                    const externalBusy = busySlotsByCell.get(key) ?? [];

                    return (
                      <Box
                        key={`${key}-cell`}
                        sx={{
                          borderTop: 1,
                          borderRight: 1,
                          borderColor: 'divider',
                          minHeight: 36,
                          p: 0.5,
                          bgcolor: 'background.paper',
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const rawId = event.dataTransfer.getData('text/appointment-id');
                          const id = Number(rawId);

                          if (!Number.isNaN(id)) {
                            void moveAppointment(id, dayKey, hour, minute);
                          }
                        }}
                        onClick={() => openCreate(dayKey, hour, minute)}
                      >
                        <Stack spacing={0.5}>
                          {externalBusy.map((slot) => (
                            <Chip
                              key={`${slot.specialistId}-${slot.scheduledAt}-${slot.source}`}
                              size="small"
                              label="Busy (Google)"
                              color="warning"
                              variant="outlined"
                            />
                          ))}
                          {items.map((item) => (
                            <Box
                              key={item.id}
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData('text/appointment-id', String(item.id))}
                              onClick={(event) => {
                                event.stopPropagation();
                                openEdit(item);
                              }}
                              sx={{
                                borderRadius: 1,
                                border: 1,
                                borderColor: item.status === 'cancelled' ? 'error.main' : 'primary.light',
                                bgcolor: item.status === 'cancelled' ? 'rgba(211, 47, 47, 0.08)' : 'rgba(25, 118, 210, 0.08)',
                                px: 0.75,
                                py: 0.5,
                                cursor: 'pointer',
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                                {formatLocalTime(item.scheduledAt)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {statusLabel(item.status)} · {item.durationMin}m
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Fragment>
              );
            })}
          </Box>
        </Box>

        <Button onClick={() => openCreate(getGridDayKey(visibleDays[0]), 9, 0)} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
          {t('appointments.create')}
        </Button>

        {isLoading ? <Typography variant="body2">{t('appointments.loading')}</Typography> : null}
      </Stack>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? t('appointments.editTitle') : t('appointments.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="startAt"
              control={control}
              render={({ field }: any) => (
                <AppRhfTextField
                  field={field}
                  label="Start time"
                  type="datetime-local"
                  minutesStep={selectedSlotStepMin}
                />
              )}
            />
            <Controller
              name="endAt"
              control={control}
              render={({ field }: any) => (
                <AppRhfTextField
                  field={field}
                  label="End time"
                  type="datetime-local"
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
            <Button color="error" onClick={cancelAppointment}>{t('appointments.cancelAction')}</Button>
          )}
          <Button onClick={() => setIsCreateOpen(false)}>{t('appointments.close')}</Button>
          <Button variant="contained" onClick={handleSubmit(submitForm)}>{t('appointments.save')}</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}
