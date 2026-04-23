import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { AppointmentFormDialog } from '../components/appointments/AppointmentFormDialog';
import { AppointmentsCalendar } from '../components/appointments/AppointmentsCalendar';
import {
  addDays,
  BROWSER_TIMEZONE,
  CalendarViewMode,
  createDatetimeLocal,
  DEFAULT_SLOT_STEP_MIN,
  fromDatetimeLocal,
  getUtcNowByTimeZone,
  isSlotInPast,
  startOfDay,
  toDateKeyInTimezone,
  toTimeKeyInTimezone,
  weekStart,
} from '../components/appointments/appointmentsUtils';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { AppointmentItem, AppointmentListResponse, SpecialistItem } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppPage } from '../shared/ui/AppPage';

export function AppointmentsContainer() {
  const { t } = useI18n();
  const { accessToken, user } = useAuth();
  const theme = useTheme();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [busySlots, setBusySlots] = useState<AppointmentListResponse['busySlots']>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | 'all'>('all');
  const displayTimeZone = BROWSER_TIMEZONE;

  const [focusDate, setFocusDate] = useState(() => startOfDay(getUtcNowByTimeZone(displayTimeZone)));
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  const pastSlotError = 'Cannot create or move an appointment to a past date/time';

  const canManageAll = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin;
  const selectedSpecialist = selectedSpecialistId === 'all'
    ? null
    : specialists.find((item) => item.id === selectedSpecialistId) ?? null;
  const selectedSlotStepMin = selectedSpecialist?.slotStepMin ?? DEFAULT_SLOT_STEP_MIN;

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
    if (isSlotInPast(targetDateKey, hour, minute, displayTimeZone)) {
      setError(pastSlotError);
      return;
    }

    const specialistId = selectedSpecialistId === 'all'
      ? specialists[0]?.id
      : selectedSpecialistId;

    if (!specialistId) {
      setError('Create at least one specialist first');
      return;
    }

    setEditingItem(null);
    setIsCreateOpen(true);
  };

  const openEdit = (item: AppointmentItem) => {
    setEditingItem(item);
    setIsCreateOpen(true);
  };

  const submitForm = async (payload: {
    specialistId: number;
    startIso: string;
    durationMin: number;
    status: AppointmentItem['status'];
    meetingLink: string;
    notes: string;
  }) => {
    if (!accessToken) {
      return;
    }

    setIsSubmittingForm(true);

    try {
      if (!editingItem && new Date(payload.startIso).getTime() < Date.now()) {
        setError(pastSlotError);
        return;
      }

      if (editingItem) {
        await apiClient.patch(`/api/appointments/${editingItem.id}`, {
          scheduledAt: payload.startIso,
          durationMin: payload.durationMin,
          status: payload.status,
          meetingLink: payload.meetingLink,
          notes: payload.notes,
        }, {
          headers: authHeaders(accessToken),
        });
      } else {
        await apiClient.post('/api/appointments', {
          specialistId: payload.specialistId,
          scheduledAt: payload.startIso,
          durationMin: payload.durationMin,
          status: payload.status,
          meetingLink: payload.meetingLink,
          notes: payload.notes,
        }, {
          headers: authHeaders(accessToken),
        });
      }

      setIsCreateOpen(false);
      await loadAppointments(selectedSpecialistId);
    } catch {
      setError('Unable to save appointment');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const cancelAppointment = async () => {
    if (!editingItem || !accessToken) {
      return;
    }

    setIsCancellingAppointment(true);

    try {
      await apiClient.post(`/api/appointments/${editingItem.id}/cancel`, {}, {
        headers: authHeaders(accessToken),
      });

      setIsCreateOpen(false);
      await loadAppointments(selectedSpecialistId);
    } catch {
      setError('Unable to cancel appointment');
    } finally {
      setIsCancellingAppointment(false);
    }
  };

  const moveAppointment = async (appointmentId: number, targetDayKey: string, targetHour: number, targetMinute: number) => {
    if (!accessToken) {
      return;
    }
    if (isSlotInPast(targetDayKey, targetHour, targetMinute, displayTimeZone)) {
      setError(pastSlotError);
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
    const previousScheduledAt = current.scheduledAt;

    setAppointments((prev) => prev.map((item) => (
      item.id === appointmentId
        ? { ...item, scheduledAt: nextIso }
        : item
    )));

    try {
      await apiClient.post(`/api/appointments/${appointmentId}/reschedule`, {
        scheduledAt: nextIso,
      }, {
        headers: authHeaders(accessToken),
      });

      void loadAppointments(selectedSpecialistId);
      setError('');
    } catch {
      setAppointments((prev) => prev.map((item) => (
        item.id === appointmentId
          ? { ...item, scheduledAt: previousScheduledAt }
          : item
      )));
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
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.14)} 0%, ${alpha(theme.palette.info.light, 0.12)} 100%)`,
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip size="small" color="primary" variant="outlined" label={viewMode === 'week' ? t('appointments.viewWeek') : t('appointments.viewDay')} />
                <Chip size="small" color="default" variant="outlined" label={selectedSpecialist ? selectedSpecialist.name : t('appointments.allSpecialists')} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {selectedSpecialist
                  ? `Timezone: ${BROWSER_TIMEZONE} · ${selectedSpecialist.timezone} · ${selectedSlotStepMin} min`
                  : `Timezone: ${BROWSER_TIMEZONE} · ${DEFAULT_SLOT_STEP_MIN} min`}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {canManageAll && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <FormControl sx={{ width: { xs: '100%', sm: 360 } }} size="small">
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
            </CardContent>
          </Card>
        )}

        <AppointmentsCalendar
          t={t}
          viewMode={viewMode}
          visibleDays={visibleDays}
          displayTimeZone={displayTimeZone}
          appointmentsByCell={appointmentsByCell}
          busySlotsByCell={busySlotsByCell}
          movePeriod={movePeriod}
          onToday={() => setFocusDate(startOfDay(new Date()))}
          onSetViewMode={setViewMode}
          onOpenCreate={openCreate}
          onOpenEdit={openEdit}
          onMoveAppointment={(id, dayKey, hour, minute) => {
            void moveAppointment(id, dayKey, hour, minute);
          }}
          pastSlotHint={pastSlotError}
          getGridDayKey={getGridDayKey}
        />
      </Stack>

      <AppointmentFormDialog
        t={t}
        open={isCreateOpen}
        editingItem={editingItem}
        specialists={specialists}
        selectedSpecialistId={selectedSpecialistId}
        selectedSlotStepMin={selectedSlotStepMin}
        isSubmittingForm={isSubmittingForm}
        isCancellingAppointment={isCancellingAppointment}
        onClose={() => setIsCreateOpen(false)}
        onCancel={cancelAppointment}
        onSubmit={(payload) => submitForm({
          specialistId: payload.specialistId,
          startIso: payload.startIso,
          durationMin: payload.durationMin,
          status: payload.status,
          meetingLink: payload.meetingLink,
          notes: payload.notes,
        })}
      />
    </AppPage>
  );
}
