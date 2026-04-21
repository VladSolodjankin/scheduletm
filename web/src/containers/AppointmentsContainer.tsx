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
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import type { AppointmentItem, AppointmentListResponse, AppointmentStatus, SpecialistItem } from '../shared/types/api';
import { WebUserRole } from '../shared/types/roles';

type EditFormState = {
  scheduledAt: string;
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
};

const STATUS_OPTIONS: AppointmentStatus[] = ['new', 'confirmed', 'cancelled'];

function getMonthMatrix(cursor: Date): Date[] {
  const firstDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const startWeekDay = firstDay.getUTCDay();
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - startWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    return day;
  });
}

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

function sameDay(left: Date, right: Date): boolean {
  return left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate();
}

function statusLabel(status: AppointmentStatus): string {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'cancelled') return 'cancelled';
  return 'new';
}

export function AppointmentsContainer() {
  const { t } = useI18n();
  const { accessToken, user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | 'all'>('all');
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  const [form, setForm] = useState<EditFormState>({
    scheduledAt: toDatetimeLocal(new Date().toISOString()),
    status: 'new',
    meetingLink: '',
    notes: '',
  });

  const monthDays = useMemo(() => getMonthMatrix(monthCursor), [monthCursor]);

  const appointmentsForSelectedDay = useMemo(() => {
    return appointments
      .filter((item) => sameDay(new Date(item.scheduledAt), selectedDay))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [appointments, selectedDay]);

  const canManageAll = user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin;

  const loadAppointments = async (nextSpecialistId: number | 'all' = selectedSpecialistId) => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.get<AppointmentListResponse>('/api/appointments', {
        headers: authHeaders(accessToken),
        params: nextSpecialistId === 'all' ? undefined : { specialistId: nextSpecialistId },
      });

      setAppointments(response.data.appointments);
      setSpecialists(response.data.specialists);
      setError('');
    } catch {
      setError('Unable to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const openCreate = () => {
    const specialistId = selectedSpecialistId === 'all'
      ? specialists[0]?.id
      : selectedSpecialistId;

    if (!specialistId) {
      setError('Create at least one specialist first');
      return;
    }

    setForm({
      scheduledAt: toDatetimeLocal(new Date(selectedDay).toISOString()),
      status: 'new',
      meetingLink: '',
      notes: '',
    });
    setEditingItem(null);
    setIsCreateOpen(true);
  };

  const submitForm = async () => {
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
    setForm({
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

  const onSpecialistChange = async (value: number | 'all') => {
    setSelectedSpecialistId(value);
    await loadAppointments(value);
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

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, gap: 2 }}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{monthCursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => setMonthCursor(new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() - 1, 1)))}>{'<'}</Button>
                <Button size="small" onClick={() => setMonthCursor(new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 1)))}>{'>'}</Button>
              </Stack>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
              {monthDays.map((day) => {
                const isCurrentMonth = day.getUTCMonth() === monthCursor.getUTCMonth();
                const isSelected = sameDay(day, selectedDay);
                const count = appointments.filter((item) => sameDay(new Date(item.scheduledAt), day)).length;

                return (
                  <Button
                    key={day.toISOString()}
                    variant={isSelected ? 'contained' : 'text'}
                    color={isCurrentMonth ? 'primary' : 'inherit'}
                    onClick={() => setSelectedDay(day)}
                    sx={{ minHeight: 70, flexDirection: 'column', alignItems: 'flex-start', textTransform: 'none' }}
                  >
                    <Typography variant="body2">{day.getUTCDate()}</Typography>
                    {count > 0 && <Typography variant="caption">{count} appt</Typography>}
                  </Button>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{selectedDay.toLocaleDateString()}</Typography>
              <Button onClick={openCreate} variant="outlined" size="small">
                {t('appointments.create')}
              </Button>
            </Box>

            {isLoading ? <Typography variant="body2">Loading...</Typography> : null}

            <Stack spacing={1.5}>
              {appointmentsForSelectedDay.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    p: 1.5,
                    cursor: 'pointer',
                  }}
                  onClick={() => openEdit(item)}
                >
                  <Typography variant="subtitle2">{new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                  <Typography variant="body2">{statusLabel(item.status)}</Typography>
                  {item.notes && <Typography variant="caption" color="text.secondary">{item.notes}</Typography>}
                </Box>
              ))}
              {appointmentsForSelectedDay.length === 0 && (
                <Typography variant="body2" color="text.secondary">{t('appointments.emptyDay')}</Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Stack>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? t('appointments.editTitle') : t('appointments.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('appointments.fields.scheduledAt')}
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl>
              <InputLabel id="status-label">{t('appointments.fields.status')}</InputLabel>
              <Select
                labelId="status-label"
                label={t('appointments.fields.status')}
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as AppointmentStatus }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('appointments.fields.meetingLink')}
              value={form.meetingLink}
              onChange={(event) => setForm((prev) => ({ ...prev, meetingLink: event.target.value }))}
            />
            <TextField
              label={t('appointments.fields.notes')}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {editingItem && (
            <Button color="error" onClick={cancelAppointment}>{t('appointments.cancelAction')}</Button>
          )}
          <Button onClick={() => setIsCreateOpen(false)}>{t('appointments.close')}</Button>
          <Button variant="contained" onClick={submitForm}>{t('appointments.save')}</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}
