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
  Snackbar,
  Skeleton,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { AppointmentFormDialog } from '../components/appointments/AppointmentFormDialog';
import { AppointmentsCalendar } from '../components/appointments/AppointmentsCalendar';
import {
  addMonths,
  addDays,
  BROWSER_TIMEZONE,
  CalendarViewMode,
  createDatetimeLocal,
  DEFAULT_SLOT_STEP_MIN,
  endOfMonth,
  fromDatetimeLocal,
  getUtcNowByTimeZone,
  isSlotInPast,
  startOfMonth,
  startOfDay,
  weekStart,
  toDateKeyInTimezone,
  toTimeKeyInTimezone,
} from '../components/appointments/appointmentsUtils';
import { apiClient, authHeaders } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type {
  AppointmentItem,
  AppointmentListResponse,
  ClientItem,
  SpecialistBookingPolicy,
  SpecialistItem,
} from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';
import { AppPage } from '../shared/ui/AppPage';

export function AppointmentsContainer() {
  const { t } = useI18n();
  const { accessToken, user } = useAuth();
  const theme = useTheme();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [busySlots, setBusySlots] = useState<AppointmentListResponse['busySlots']>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | 'all'>('all');
  const [selectedClientId, setSelectedClientId] = useState<number | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AppointmentItem['status'] | 'all'>('all');
  const [serviceQuery, setServiceQuery] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const displayTimeZone = BROWSER_TIMEZONE;

  const [focusDate, setFocusDate] = useState(() => startOfDay(getUtcNowByTimeZone(displayTimeZone)));
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isNotifyingClient, setIsNotifyingClient] = useState(false);
  const [pastSlotToastOpen, setPastSlotToastOpen] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  const [createInitialScheduledAtIso, setCreateInitialScheduledAtIso] = useState<string | null>(null);
  const [bookingPolicies, setBookingPolicies] = useState<Record<number, SpecialistBookingPolicy>>({});
  const pastSlotError = t('appointments.pastSlotError');

  const showPastSlotError = () => {
    setPastSlotToastOpen(true);
  };

  const canManageAll = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin;
  const isOwner = user?.role === WebUserRole.Owner;
  const isAdmin = user?.role === WebUserRole.Admin;
  const isSpecialist = user?.role === WebUserRole.Specialist;
  const isClient = user?.role === WebUserRole.Client;
  const selectedSpecialist = selectedSpecialistId === 'all'
    ? null
    : specialists.find((item) => item.id === selectedSpecialistId) ?? null;
  const selectedSlotStepMin = selectedSpecialist?.slotStepMin ?? DEFAULT_SLOT_STEP_MIN;

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [startOfDay(focusDate)];
    }
    if (viewMode === 'month') {
      const monthStart = startOfMonth(focusDate);
      const monthEnd = endOfMonth(focusDate);
      const daysCount = monthEnd.getDate();
      return Array.from({ length: daysCount }, (_, index) => addDays(monthStart, index));
    }

    const start = weekStart(focusDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [focusDate, viewMode]);

  const filteredAppointments = useMemo(() => appointments.filter((item) => {
    if (selectedClientId !== 'all' && item.client.id !== selectedClientId) {
      return false;
    }

    if (selectedStatus !== 'all' && item.status !== selectedStatus) {
      return false;
    }

    if (serviceQuery.trim()) {
      const serviceText = item.notes.toLowerCase();
      if (!serviceText.includes(serviceQuery.trim().toLowerCase())) {
        return false;
      }
    }

    const scheduledDate = new Date(item.scheduledAt);
    if (fromDateFilter) {
      const fromDate = new Date(`${fromDateFilter}T00:00:00`);
      if (scheduledDate < fromDate) {
        return false;
      }
    }

    if (toDateFilter) {
      const toDate = new Date(`${toDateFilter}T23:59:59`);
      if (scheduledDate > toDate) {
        return false;
      }
    }

    return true;
  }), [appointments, fromDateFilter, selectedClientId, selectedStatus, serviceQuery, toDateFilter]);

  const appointmentsByCell = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();

    for (const item of filteredAppointments) {
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
  }, [displayTimeZone, filteredAppointments]);

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

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();

    for (const item of filteredAppointments) {
      const date = new Date(item.scheduledAt);
      const dayKey = toDateKeyInTimezone(date, displayTimeZone);
      const list = map.get(dayKey) ?? [];
      list.push(item);
      map.set(dayKey, list);
    }

    map.forEach((list) => {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    });

    return map;
  }, [displayTimeZone, filteredAppointments]);

  const pageSubtitle = useMemo(() => {
    if (isOwner) {
      return t('appointments.pageSubtitleOwner');
    }
    if (isAdmin) {
      return t('appointments.pageSubtitleAdmin');
    }
    if (isSpecialist) {
      return t('appointments.pageSubtitleSpecialist');
    }
    if (isClient) {
      return t('appointments.pageSubtitleClient');
    }

    return t('appointments.pageSubtitle');
  }, [isAdmin, isClient, isOwner, isSpecialist, t]);

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
      setClients(response.data.clients ?? []);
      setBusySlots(response.data.busySlots ?? []);
      setError('');
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('appointments.errors.load'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    void loadAppointments(selectedSpecialistId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, focusDate, viewMode, selectedSpecialistId]);

  const openCreate = (targetDateKey: string, hour: number, minute = 0) => {
    if (isSlotInPast(targetDateKey, hour, minute, displayTimeZone)) {
      showPastSlotError();
      return;
    }

    const specialistId = selectedSpecialistId === 'all'
      ? specialists[0]?.id
      : selectedSpecialistId;

    if (!specialistId) {
      setError(t('appointments.errors.createSpecialistFirst'));
      return;
    }

    const slotIso = fromDatetimeLocal(
      createDatetimeLocal(targetDateKey, hour, minute),
      displayTimeZone,
    );
    setEditingItem(null);
    setCreateInitialScheduledAtIso(slotIso);
    setIsCreateOpen(true);
  };

  const openEdit = (item: AppointmentItem) => {
    setEditingItem(item);
    setCreateInitialScheduledAtIso(null);
    setIsCreateOpen(true);
  };

  useEffect(() => {
    const loadPolicy = async () => {
      if (!accessToken || !editingItem?.specialistId || bookingPolicies[editingItem.specialistId]) {
        return;
      }

      try {
        const response = await apiClient.get<SpecialistBookingPolicy>('/api/settings/specialist-booking-policy', {
          headers: authHeaders(accessToken),
          params: { specialistId: editingItem.specialistId },
        });
        setBookingPolicies((prev) => ({
          ...prev,
          [editingItem.specialistId]: response.data,
        }));
      } catch {
        // Do not block appointment editing if policy fetch fails.
      }
    };

    void loadPolicy();
  }, [accessToken, bookingPolicies, editingItem]);

  const cancelRefundOutcome = useMemo(() => {
    if (!editingItem) {
      return 'refund';
    }

    const policy = bookingPolicies[editingItem.specialistId];
    if (!policy) {
      return 'refund';
    }

    const appointmentAtMs = new Date(editingItem.scheduledAt).getTime();
    const diffMs = appointmentAtMs - Date.now();
    const isLateCancel = diffMs <= policy.cancelGracePeriodHours * 60 * 60 * 1000;
    return isLateCancel && !policy.refundOnLateCancel ? 'no_refund' : 'refund';
  }, [bookingPolicies, editingItem]);

  const submitForm = async (payload: {
    specialistId: number;
    appointmentAt: string;
    appointmentEndAt: string;
    status: AppointmentItem['status'];
    meetingLink: string;
    notes: string;
    clientId?: number;
    username: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }) => {
    if (!accessToken) {
      return;
    }

    setIsSubmittingForm(true);

    try {
      if (!editingItem && new Date(payload.appointmentAt).getTime() < Date.now()) {
        showPastSlotError();
        return;
      }

      if (editingItem) {
        await apiClient.patch(`/api/appointments/${editingItem.id}`, {
          appointmentAt: payload.appointmentAt,
          appointmentEndAt: payload.appointmentEndAt,
          status: payload.status,
          meetingLink: payload.meetingLink,
          notes: payload.notes,
          clientId: payload.clientId,
          username: payload.username,
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          email: payload.email,
        }, {
          headers: authHeaders(accessToken),
        });
      } else {
        await apiClient.post('/api/appointments', {
          specialistId: payload.specialistId,
          appointmentAt: payload.appointmentAt,
          appointmentEndAt: payload.appointmentEndAt,
          status: payload.status,
          meetingLink: payload.meetingLink,
          notes: payload.notes,
          clientId: payload.clientId,
          username: payload.username,
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          email: payload.email,
        }, {
          headers: authHeaders(accessToken),
        });
      }

      setIsCreateOpen(false);
      await loadAppointments(selectedSpecialistId);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('appointments.errors.save'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const cancelAppointment = async () => {
    if (!editingItem || !accessToken) {
      return;
    }

    const confirmationMessage = cancelRefundOutcome === 'no_refund'
      ? t('appointments.cancelConfirmNoRefund')
      : t('appointments.cancelConfirmRefund');
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setIsCancellingAppointment(true);

    try {
      await apiClient.post(`/api/appointments/${editingItem.id}/cancel`, {}, {
        headers: authHeaders(accessToken),
      });

      setIsCreateOpen(false);
      await loadAppointments(selectedSpecialistId);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('appointments.errors.cancel'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsCancellingAppointment(false);
    }
  };

  const markAppointmentPaid = async () => {
    if (!editingItem || !accessToken) {
      return;
    }

    setIsMarkingPaid(true);

    try {
      await apiClient.post(`/api/appointments/${editingItem.id}/mark-paid`, {}, {
        headers: authHeaders(accessToken),
      });
      await loadAppointments(selectedSpecialistId);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('appointments.errors.markPaid'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const notifyClient = async () => {
    if (!editingItem || !accessToken) {
      return;
    }

    setIsNotifyingClient(true);

    try {
      await apiClient.post(`/api/appointments/${editingItem.id}/notify`, {}, {
        headers: authHeaders(accessToken),
      });
      await loadAppointments(selectedSpecialistId);
    } catch (err) {
      setError(resolveApiError(err, {
        fallbackMessage: t('appointments.errors.notify'),
        networkMessage: t('common.errors.network')
      }).message);
    } finally {
      setIsNotifyingClient(false);
    }
  };

  const moveAppointment = async (appointmentId: number, targetDayKey: string, targetHour: number, targetMinute: number) => {
    if (!accessToken) {
      return;
    }
    if (isSlotInPast(targetDayKey, targetHour, targetMinute, displayTimeZone)) {
      showPastSlotError();
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
    } catch (err) {
      setAppointments((prev) => prev.map((item) => (
        item.id === appointmentId
          ? { ...item, scheduledAt: previousScheduledAt }
          : item
      )));
      setError(resolveApiError(err, {
        fallbackMessage: t('appointments.errors.reschedule'),
        networkMessage: t('common.errors.network')
      }).message);
    }
  };

  const movePeriod = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      setFocusDate((prev) => addMonths(prev, direction));
      return;
    }

    const delta = viewMode === 'day' ? direction : direction * 7;
    setFocusDate((prev) => addDays(prev, delta));
  };

  const isInitialLoading = !hasLoadedOnce && isLoading;

  return (
    <AppPage
      title={t('appointments.pageTitle')}
      subtitle={pageSubtitle}
    >
      {error && (
        <Box sx={{ mb: 2 }}>
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
              {isOwner && (
                <FormControl sx={{ width: { xs: '100%', sm: 240 } }} size="small" disabled>
                  <InputLabel id="account-filter">{t('appointments.accountFilter')}</InputLabel>
                  <Select
                    labelId="account-filter"
                    label={t('appointments.accountFilter')}
                    value="current"
                  >
                    <MenuItem value="current">{t('appointments.currentAccount')}</MenuItem>
                  </Select>
                </FormControl>
              )}

              {canManageAll && (
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
              )}

              {(isOwner || isAdmin || isSpecialist) && (
                <FormControl sx={{ width: { xs: '100%', sm: 300 } }} size="small">
                  <InputLabel id="client-filter">{t('appointments.clientFilter')}</InputLabel>
                  <Select
                    labelId="client-filter"
                    label={t('appointments.clientFilter')}
                    value={selectedClientId}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setSelectedClientId(raw === 'all' ? 'all' : Number(raw));
                    }}
                  >
                    <MenuItem value="all">{t('appointments.allClients')}</MenuItem>
                    {clients.map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {[client.firstName, client.lastName].filter(Boolean).join(' ').trim() || client.email}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {isClient && (
                <FormControl sx={{ width: { xs: '100%', sm: 320 } }} size="small">
                  <InputLabel id="specialist-filter-client">{t('appointments.specialistFilter')}</InputLabel>
                  <Select
                    labelId="specialist-filter-client"
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

              <TextField
                type="text"
                label={t('appointments.serviceFilter')}
                size="small"
                value={serviceQuery}
                onChange={(event) => setServiceQuery(event.target.value)}
                sx={{ width: { xs: '100%', sm: 260 } }}
              />

              <FormControl sx={{ width: { xs: '100%', sm: 220 } }} size="small">
                <InputLabel id="status-filter">{t('appointments.statusFilter')}</InputLabel>
                <Select
                  labelId="status-filter"
                  label={t('appointments.statusFilter')}
                  value={selectedStatus}
                  onChange={(event) => {
                    const raw = event.target.value as AppointmentItem['status'] | 'all';
                    setSelectedStatus(raw);
                  }}
                >
                  <MenuItem value="all">{t('appointments.allStatuses')}</MenuItem>
                  <MenuItem value="new">{t('appointments.statusNew')}</MenuItem>
                  <MenuItem value="confirmed">{t('appointments.statusConfirmed')}</MenuItem>
                  <MenuItem value="cancelled">{t('appointments.statusCancelled')}</MenuItem>
                </Select>
              </FormControl>

              <TextField
                type="date"
                label={t('appointments.fromDateFilter')}
                size="small"
                value={fromDateFilter}
                onChange={(event) => setFromDateFilter(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: { xs: '100%', sm: 180 } }}
              />
              <TextField
                type="date"
                label={t('appointments.toDateFilter')}
                size="small"
                value={toDateFilter}
                onChange={(event) => setToDateFilter(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: { xs: '100%', sm: 180 } }}
              />
            </Stack>
          </CardContent>
        </Card>

        {isInitialLoading ? (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">{t('appointments.loading')}</Typography>
                <Skeleton variant="rounded" height={42} />
                <Skeleton variant="rounded" height={520} />
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <AppointmentsCalendar
            t={t}
            viewMode={viewMode}
            visibleDays={visibleDays}
            displayTimeZone={displayTimeZone}
            appointmentsByCell={appointmentsByCell}
            appointmentsByDay={appointmentsByDay}
            busySlotsByCell={busySlotsByCell}
            movePeriod={movePeriod}
            onToday={() => setFocusDate(startOfDay(new Date()))}
            onSetViewMode={setViewMode}
            onOpenCreate={openCreate}
            onOpenEdit={openEdit}
            onMoveAppointment={(id, dayKey, hour, minute) => {
              void moveAppointment(id, dayKey, hour, minute);
            }}
            onPastSlotAttempt={showPastSlotError}
            getGridDayKey={getGridDayKey}
          />
        )}
      </Stack>

      <Snackbar
        open={pastSlotToastOpen}
        autoHideDuration={3000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setPastSlotToastOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setPastSlotToastOpen(false)}>
          {pastSlotError}
        </Alert>
      </Snackbar>

      <AppointmentFormDialog
        t={t}
        open={isCreateOpen}
        editingItem={editingItem}
        specialists={specialists}
        clients={clients}
        selectedSpecialistId={selectedSpecialistId}
        selectedSlotStepMin={selectedSlotStepMin}
        initialScheduledAtIso={createInitialScheduledAtIso}
        isSubmittingForm={isSubmittingForm}
        isCancellingAppointment={isCancellingAppointment}
        isMarkingPaid={isMarkingPaid}
        isNotifyingClient={isNotifyingClient}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateInitialScheduledAtIso(null);
        }}
        onCancel={cancelAppointment}
        cancelPolicyText={editingItem
          ? (cancelRefundOutcome === 'no_refund'
            ? t('appointments.cancelPolicyNoRefund')
            : t('appointments.cancelPolicyRefund'))
          : ''}
        onMarkPaid={markAppointmentPaid}
        onNotifyClient={notifyClient}
        onSubmit={(payload) => submitForm({
          specialistId: payload.specialistId,
          appointmentAt: payload.appointmentAt,
          appointmentEndAt: payload.appointmentEndAt,
          status: payload.status,
          meetingLink: payload.meetingLink,
          notes: payload.notes,
          clientId: payload.clientId,
          username: payload.username,
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          email: payload.email,
        })}
      />
    </AppPage>
  );
}
