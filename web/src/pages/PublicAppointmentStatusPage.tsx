import { Alert, Link, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PublicAppointmentMeetingStatus } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';

export function PublicAppointmentStatusPage() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const [appointmentId, setAppointmentId] = useState('');
  const [specialistLastName, setSpecialistLastName] = useState('');
  const [meeting, setMeeting] = useState<PublicAppointmentMeetingStatus | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMeeting(null);
    try {
      const response = await apiClient.get<PublicAppointmentMeetingStatus>(
        `/api/public-pages/by-slug/${encodeURIComponent(slug)}/appointments/${encodeURIComponent(appointmentId)}/status`,
        { params: { specialistLastName } },
      );
      setMeeting(response.data);
    } catch (requestError) {
      setError(resolveApiError(requestError, { fallbackMessage: t('publicStatus.errors.load') }).message);
    } finally {
      setIsLoading(false);
    }
  };

  return <AppPage title={t('publicStatus.title')} maxWidth={640}>
    <Stack spacing={2}>
      <AppSurface component="form" onSubmit={submit}>
        <Stack spacing={2}>
          <TextField label={t('publicStatus.appointmentId')} inputMode="numeric" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} />
          <TextField label={t('publicStatus.specialistLastName')} value={specialistLastName} onChange={(e) => setSpecialistLastName(e.target.value)} />
          <AppButton type="submit" variant="contained" disabled={!appointmentId || !specialistLastName.trim()} isLoading={isLoading}>{t('publicStatus.submit')}</AppButton>
        </Stack>
      </AppSurface>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {meeting ? <AppSurface>
        <Stack spacing={1}>
          <Typography variant="h6">{meeting.service}</Typography>
          <Typography>{meeting.specialist}</Typography>
          <Typography>{new Date(meeting.scheduledAt).toLocaleString()} · {meeting.duration} {t('publicStatus.minutes')}</Typography>
          <Typography>{t('publicStatus.status')}: {meeting.status}</Typography>
          {meeting.meeting.location ? <Typography>{meeting.meeting.location}</Typography> : null}
          {meeting.meeting.meetingUrl ? <Link href={meeting.meeting.meetingUrl} target="_blank" rel="noreferrer">{t('publicStatus.openMeeting')}</Link> : null}
        </Stack>
      </AppSurface> : null}
    </Stack>
  </AppPage>;
}
