import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Chip,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';
import type { AppointmentItem, AppointmentListResponse, AppointmentStatus, SpecialistItem } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';

type EditFormState = {
  scheduledAt: string;
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
};

type CalendarViewMode = 'day' | 'week';

const STATUS_OPTIONS: AppointmentStatus[] = ['new', 'confirmed', 'cancelled'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

function statusLabel(status: AppointmentStatus): string {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'cancelled') return 'cancelled';
  return 'new';
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function sameDay(left: Date, right: Date): boolean {
  return left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate();
}

function weekStart(date: Date): Date {
  const base = startOfDay(date);
  const day = base.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setUTCDate(base.getUTCDate() + diff);
  return base;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function atHour(date: Date, hour: number): Date {
  const next = new Date(date);
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}

export function AppointmentsContainer() {
  const { t } = useI18n();
  const { accessToken, user } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [busySlots, setBusySlots] = useState<AppointmentListResponse['busySlots']>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | 'all'>('all');

  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  const initialFormValues: EditFormState = {
    scheduledAt: toDatetimeLocal(new Date().toISOString()),
    status: 'new',
    meetingLink: '',
    notes: '',
  };

  const { control, handleSubmit, reset } = useForm<EditFormState>({
    defaultValues: initialFormValues,
  });

  const canManageAll = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin;

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
      const dayKey = startOfDay(date).toISOString();
      const key = `${dayKey}:${date.getUTCHours()}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }

    map.forEach((list) => {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    });

    return map;
  }, [appointments]);

  const busySlotsByCell = useMemo(() => {
    const map = new Map<string, AppointmentListResponse['busySlots']>();

    for (const slot of busySlots) {
      const date = new Date(slot.scheduledAt);
      const dayKey = startOfDay(date).toISOString();
      const key = `${dayKey}:${date.getUTCHours()}`;
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }

    return map;
  }, [busySlots]);

  function getVisibleRange() {
    const firstDay = visibleDays[0] ?? startOfDay(new Date());
    const lastDay = visibleDays[visibleDays.length - 1] ?? firstDay;
    const from = new Date(firstDay);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(lastDay);
    to.setUTCHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
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

  const openCreate = (targetDate: Date) => {
    const specialistId = selectedSpecialistId === 'all'
      ? specialists[0]?.id
      : selectedSpecialistId;

    if (!specialistId) {
      setError('Create at least one specialist first');
      return;
    }

    reset({
      scheduledAt: toDatetimeLocal(targetDate.toISOString()),
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

    try {
      if (editingItem) {
        await apiClient.patch(`/api/appointments/${editingItem.id}`, {
          scheduledAt: fromDatetimeLocal(form.scheduledAt),
          status: form.status,
          meetingLink: form.meetingLink,
          notes: form.notes,
        }, {
          headers: authHeaders(accessToken),
        });
      } else {
        await apiClient.post('/api/appointments', {
          specialistId,
          scheduledAt: fromDatetimeLocal(form.scheduledAt),
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
    setEditingItem(item);
    reset({
      scheduledAt: toDatetimeLocal(item.scheduledAt),
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

  const moveAppointment = async (appointmentId: number, targetDate: Date) => {
    if (!accessToken) {
      return;
    }

    const current = appointments.find((item) => item.id === appointmentId);

    if (!current) {
      return;
    }

    const sourceDate = new Date(current.scheduledAt);
    const next = new Date(targetDate);
    next.setUTCMinutes(sourceDate.getUTCMinutes(), 0, 0);

    try {
      await apiClient.post(`/api/appointments/${appointmentId}/reschedule`, {
        scheduledAt: next.toISOString(),
      }, {
        headers: authHeaders(accessToken),
      });

      await loadAppointments(selectedSpecialistId);
      setError('');
    } catch {
      setError('Unable to reschedule appointment');
    }
  };

  const onSpecialistChange = (value: number | 'all') => {
    setSelectedSpecialistId(value);
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
                void onSpecialistChange(raw === 'all' ? 'all' : Number(raw));
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
            <Button size="small" variant="outlined" onClick={() => setFocusDate(startOfDay(new Date()))}>{t('appointments.today')}</Button>
            <Button size="small" variant="outlined" onClick={() => movePeriod(1)}>{'>'}</Button>
          </Stack>

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {viewMode === 'week'
              ? `${visibleDays[0].toLocaleDateString()} — ${visibleDays[visibleDays.length - 1].toLocaleDateString()}`
              : visibleDays[0].toLocaleDateString()}
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
                  bgcolor: sameDay(day, new Date()) ? 'action.selected' : 'background.default',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </Typography>
                <Typography variant="caption" color="text.secondary">{day.toLocaleDateString()}</Typography>
              </Box>
            ))}

            {HOURS.map((hour) => (
              <Fragment key={`row-${hour}`}>
                <Box
                  sx={{
                    borderTop: 1,
                    borderRight: 1,
                    borderColor: 'divider',
                    px: 1,
                    py: 1.5,
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">{`${String(hour).padStart(2, '0')}:00`}</Typography>
                </Box>

                {visibleDays.map((day) => {
                  const slotDate = atHour(day, hour);
                  const key = `${startOfDay(day).toISOString()}:${hour}`;
                  const items = appointmentsByCell.get(key) ?? [];
                  const externalBusy = busySlotsByCell.get(key) ?? [];

                  return (
                    <Box
                      key={`${key}-cell`}
                      sx={{
                        borderTop: 1,
                        borderRight: 1,
                        borderColor: 'divider',
                        minHeight: 76,
                        p: 0.5,
                        bgcolor: 'background.paper',
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const rawId = event.dataTransfer.getData('text/appointment-id');
                        const id = Number(rawId);

                        if (!Number.isNaN(id)) {
                          void moveAppointment(id, slotDate);
                        }
                      }}
                      onDoubleClick={() => openCreate(slotDate)}
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
                            onClick={() => openEdit(item)}
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
                              {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {statusLabel(item.status)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
              </Fragment>
            ))}
          </Box>
        </Box>

        <Button onClick={() => openCreate(atHour(visibleDays[0], 9))} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
          {t('appointments.create')}
        </Button>

        {isLoading ? <Typography variant="body2">{t('appointments.loading')}</Typography> : null}
      </Stack>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? t('appointments.editTitle') : t('appointments.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="scheduledAt"
              control={control}
              render={({ field }: any) => (
                <AppRhfTextField
                  field={field}
                  label={t('appointments.fields.scheduledAt')}
                  type="datetime-local"
                  slotProps={{ inputLabel: { shrink: true } }}
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
