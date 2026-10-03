import { Alert, Link, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useI18n } from '../shared/i18n/I18nContext';
import type { AppointmentManagementDetails } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppLoadingState } from '../shared/ui/AppStatus';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';

export function AppointmentManagePage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [details, setDetails] = useState<AppointmentManagementDetails | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get<AppointmentManagementDetails>(
        `/api/public/appointment-management/${encodeURIComponent(token)}`,
      );
      setDetails(response.data);
    } catch (requestError) {
      setError(resolveApiError(requestError, { fallbackMessage: t('appointmentManage.errors.load') }).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const cancelAppointment = async () => {
    setIsCancelling(true);
    setActionError('');
    try {
      const response = await apiClient.post<AppointmentManagementDetails>(
        `/api/public/appointment-management/${encodeURIComponent(token)}/cancel`,
      );
      setDetails(response.data);
      setIsCancelConfirmOpen(false);
    } catch (requestError) {
      setActionError(resolveApiError(requestError, { fallbackMessage: t('appointmentManage.errors.cancel') }).message);
    } finally {
      setIsCancelling(false);
    }
  };

  const rescheduleAppointment = async () => {
    if (!newScheduledAt) {
      return;
    }

    setIsRescheduling(true);
    setActionError('');
    try {
      const response = await apiClient.post<AppointmentManagementDetails>(
        `/api/public/appointment-management/${encodeURIComponent(token)}/reschedule`,
        { scheduledAt: new Date(newScheduledAt).toISOString() },
      );
      setDetails(response.data);
      setShowRescheduleForm(false);
    } catch (requestError) {
      setActionError(resolveApiError(requestError, { fallbackMessage: t('appointmentManage.errors.reschedule') }).message);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <AppPage title={t('appointmentManage.title')} maxWidth={640}>
      <Stack spacing={2}>
        {isLoading ? <AppLoadingState /> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {details ? (
          <AppSurface>
            <Stack spacing={1}>
              <Typography variant="h6">{details.service}</Typography>
              <Typography>{details.specialist}</Typography>
              <Typography>
                {new Date(details.scheduledAt).toLocaleString()} · {details.durationMin} {t('appointmentManage.minutes')}
              </Typography>
              <Typography>{t('appointmentManage.status')}: {details.status}</Typography>
              {details.meeting.location ? <Typography>{details.meeting.location}</Typography> : null}
              {details.meeting.meetingUrl ? (
                <Link href={details.meeting.meetingUrl} target="_blank" rel="noreferrer">
                  {t('appointmentManage.openMeeting')}
                </Link>
              ) : null}

              {actionError ? <Alert severity="error">{actionError}</Alert> : null}

              {!details.canCancel && !details.canReschedule ? (
                <Typography variant="body2" color="text.secondary">
                  {t('appointmentManage.notManageable')}
                </Typography>
              ) : null}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {details.canCancel ? (
                  <AppButton color="error" onClick={() => setIsCancelConfirmOpen(true)}>
                    {t('appointmentManage.cancelAction')}
                  </AppButton>
                ) : null}
                {details.canReschedule ? (
                  <AppButton variant="text" onClick={() => setShowRescheduleForm((prev) => !prev)}>
                    {t('appointmentManage.rescheduleAction')}
                  </AppButton>
                ) : null}
              </Stack>

              {showRescheduleForm ? (
                <Stack spacing={2}>
                  <TextField
                    type="datetime-local"
                    label={t('appointmentManage.rescheduleLabel')}
                    value={newScheduledAt}
                    onChange={(event) => setNewScheduledAt(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <AppButton
                    variant="contained"
                    onClick={rescheduleAppointment}
                    isLoading={isRescheduling}
                    disabled={!newScheduledAt}
                  >
                    {t('appointmentManage.rescheduleSubmit')}
                  </AppButton>
                </Stack>
              ) : null}
            </Stack>
          </AppSurface>
        ) : null}
      </Stack>

      <AppConfirmDialog
        open={isCancelConfirmOpen}
        onClose={() => !isCancelling && setIsCancelConfirmOpen(false)}
        maxWidth="xs"
        title={t('appointmentManage.cancelConfirmTitle')}
        description={t('appointmentManage.cancelConfirmDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('appointmentManage.cancelAction')}
        confirmColor="error"
        isLoading={isCancelling}
        onCancel={() => setIsCancelConfirmOpen(false)}
        onConfirm={() => void cancelAppointment()}
      />
    </AppPage>
  );
}
