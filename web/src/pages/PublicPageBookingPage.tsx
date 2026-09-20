import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PublicAvailableSlots, PublicBookingOptions, PublicBookingResult } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';

type FormState = {
  specialistId: string;
  serviceId: string;
  date: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  meetingProvider: '' | 'manual' | 'zoom' | 'offline';
};

function todayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const emptyForm: FormState = {
  specialistId: '', serviceId: '', date: todayDateInputValue(), firstName: '', lastName: '',
  email: '', phone: '', meetingProvider: '',
};

export function PublicPageBookingPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [options, setOptions] = useState<PublicBookingOptions | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slotsState, setSlotsState] = useState<{ key: string; slots: string[]; error: string }>({ key: '', slots: [], error: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublicBookingResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void apiClient.get<PublicBookingOptions>(`/api/public-pages/by-slug/${encodeURIComponent(slug)}/booking-options`)
      .then(({ data }) => {
        if (!active) {
          return;
        }
        setOptions(data);
        const specialistParam = searchParams.get('specialist');
        const serviceParam = searchParams.get('service');
        setForm((previous) => ({
          ...previous,
          specialistId: data.specialists.some(({ id }) => String(id) === specialistParam)
            ? specialistParam! : data.specialists.length === 1 ? String(data.specialists[0].id) : '',
          serviceId: data.services.some(({ id }) => String(id) === serviceParam)
            ? serviceParam! : data.services.length === 1 ? String(data.services[0].id) : '',
        }));
      })
      .catch((requestError) => {
        if (active) {
          setError(resolveApiError(requestError, { fallbackMessage: t('publicBooking.errors.load') }).message);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => { active = false; };
  }, [searchParams, slug, t]);

  const slotsKey = `${form.specialistId}|${form.serviceId}|${form.date}`;
  const isLoadingSlots = Boolean(form.specialistId && form.serviceId && form.date) && slotsState.key !== slotsKey;

  useEffect(() => {
    if (!form.specialistId || !form.serviceId || !form.date) {
      return;
    }
    let active = true;
    void apiClient.get<PublicAvailableSlots>(`/api/public-pages/by-slug/${encodeURIComponent(slug)}/available-slots`, {
      params: { specialistId: form.specialistId, serviceId: form.serviceId, date: form.date },
    })
      .then(({ data }) => {
        if (active) {
          setSlotsState({ key: slotsKey, slots: data.slots, error: '' });
        }
      })
      .catch((requestError) => {
        if (active) {
          setSlotsState({
            key: slotsKey, slots: [],
            error: resolveApiError(requestError, { fallbackMessage: t('publicBooking.errors.slots') }).message,
          });
        }
      });
    return () => { active = false; };
  }, [slotsKey, form.specialistId, form.serviceId, form.date, slug, t]);

  const slots = slotsState.key === slotsKey ? slotsState.slots : [];
  const slotsError = slotsState.key === slotsKey ? slotsState.error : '';

  const canSubmit = useMemo(() => Boolean(
    form.specialistId && form.serviceId && selectedSlot && form.firstName.trim()
    && form.lastName.trim() && (form.email.trim() || form.phone.trim())
  ), [form, selectedSlot]);

  const update = (key: keyof FormState, value: string) => {
    if (key === 'specialistId' || key === 'serviceId' || key === 'date') {
      setSelectedSlot('');
    }
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setError(t('publicBooking.errors.required'));
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await apiClient.post<PublicBookingResult>(
        `/api/public-pages/by-slug/${encodeURIComponent(slug)}/appointments`,
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          specialistId: Number(form.specialistId),
          serviceId: Number(form.serviceId),
          startAt: selectedSlot,
          ...(timezone ? { timezone } : {}),
          ...(form.meetingProvider ? { meetingProvider: form.meetingProvider } : {}),
        },
      );
      setResult(response.data);
    } catch (requestError) {
      setError(resolveApiError(requestError, { fallbackMessage: t('publicBooking.errors.submit') }).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return <AppPage title={t('publicBooking.successTitle')} maxWidth={640}>
      <Stack spacing={2}>
        <Alert severity="success">
          {t('publicBooking.successMessage').replace('{id}', String(result.id))}
        </Alert>
        <AppSurface>
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">{t('publicBooking.accessCodeLabel')}</Typography>
            <Typography variant="h5" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>{result.accessCode}</Typography>
            <Typography variant="body2" color="text.secondary">{t('publicBooking.accessCodeHint')}</Typography>
          </Stack>
        </AppSurface>
      </Stack>
    </AppPage>;
  }

  return <AppPage title={t('publicBooking.title')} subtitle={t('publicBooking.subtitle')} maxWidth={720}>
    <AppSurface component="form" onSubmit={submit}>
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {isLoading ? <Typography>{t('publicBooking.loading')}</Typography> : null}
        <FormControl fullWidth disabled={isLoading}>
          <InputLabel>{t('publicBooking.specialist')}</InputLabel>
          <Select value={form.specialistId} label={t('publicBooking.specialist')} onChange={(e) => update('specialistId', String(e.target.value))}>
            {options?.specialists.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth disabled={isLoading}>
          <InputLabel>{t('publicBooking.service')}</InputLabel>
          <Select value={form.serviceId} label={t('publicBooking.service')} onChange={(e) => update('serviceId', String(e.target.value))}>
            {options?.services.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label={t('publicBooking.date')} type="date" value={form.date} onChange={(e) => update('date', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Stack spacing={1}>
          <Typography variant="subtitle2">{t('publicBooking.availableSlots')}</Typography>
          {isLoadingSlots ? <Typography variant="body2" color="text.secondary">{t('publicBooking.loadingSlots')}</Typography> : null}
          {slotsError ? <Alert severity="error">{slotsError}</Alert> : null}
          {!isLoadingSlots && !slotsError && form.specialistId && form.serviceId && slots.length === 0
            ? <Typography variant="body2" color="text.secondary">{t('publicBooking.noSlots')}</Typography>
            : null}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {slots.map((slot) => (
              <Button
                key={slot}
                variant={selectedSlot === slot ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setSelectedSlot(slot)}
              >
                {new Date(slot).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Button>
            ))}
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField fullWidth label={t('publicBooking.firstName')} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
          <TextField fullWidth label={t('publicBooking.lastName')} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField fullWidth label={t('publicBooking.email')} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          <TextField fullWidth label={t('publicBooking.phone')} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </Stack>
        <Typography variant="caption" color="text.secondary">{t('publicBooking.contactHint')}</Typography>
        <FormControl fullWidth>
          <InputLabel>{t('publicBooking.provider')}</InputLabel>
          <Select value={form.meetingProvider} label={t('publicBooking.provider')} onChange={(e) => update('meetingProvider', String(e.target.value))}>
            <MenuItem value="">{t('publicBooking.providerAutomatic')}</MenuItem>
            <MenuItem value="manual">{t('publicBooking.providerManual')}</MenuItem>
            <MenuItem value="zoom">{t('publicBooking.providerZoom')}</MenuItem>
            <MenuItem value="offline">{t('publicBooking.providerOffline')}</MenuItem>
          </Select>
        </FormControl>
        <AppButton type="submit" variant="contained" disabled={!canSubmit || isLoading} isLoading={isSubmitting}>{t('publicBooking.submit')}</AppButton>
      </Stack>
    </AppSurface>
  </AppPage>;
}
