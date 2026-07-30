import { Alert, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PublicBookingOptions, PublicBookingResult } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';

type FormState = {
  specialistId: string;
  serviceId: string;
  startAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  meetingProvider: '' | 'manual' | 'zoom' | 'offline';
};

const emptyForm: FormState = {
  specialistId: '', serviceId: '', startAt: '', firstName: '', lastName: '',
  email: '', phone: '', meetingProvider: '',
};

export function PublicPageBookingPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [options, setOptions] = useState<PublicBookingOptions | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
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

  const canSubmit = useMemo(() => Boolean(
    form.specialistId && form.serviceId && form.startAt && form.firstName.trim()
    && form.lastName.trim() && (form.email.trim() || form.phone.trim())
  ), [form]);

  const update = (key: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
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
          startAt: new Date(form.startAt).toISOString(),
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
      <Alert severity="success">
        {t('publicBooking.successMessage').replace('{id}', String(result.id))}
      </Alert>
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
        <TextField label={t('publicBooking.dateTime')} type="datetime-local" value={form.startAt} onChange={(e) => update('startAt', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
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
