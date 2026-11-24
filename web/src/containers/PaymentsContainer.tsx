import { Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PaymentsSettingsTab, type PaymentsNotification } from '../components/settings-tabs/PaymentsSettingsTab';
import { buildPaymentsCopy } from '../components/settings-tabs/paymentsCopy';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import { AppStatusMessage } from '../shared/ui/AppStatus';

export function PaymentsContainer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const paymentsCopy = useMemo(() => buildPaymentsCopy(t), [t]);
  const stripeOauthStatus = useMemo(() => searchParams.get('stripe_oauth'), [searchParams]);
  const oauthReason = useMemo(() => searchParams.get('reason'), [searchParams]);

  useEffect(() => {
    if (!stripeOauthStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (stripeOauthStatus === 'success') {
        setSuccess(t('payments.stripeConnectedSuccess'));
        setError('');
      }

      if (stripeOauthStatus === 'error') {
        setError(
          oauthReason === 'stripe_oauth_not_configured'
            ? t('payments.stripeNotConfigured')
            : t('payments.stripeConnectError')
        );
        setSuccess('');
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('stripe_oauth');
      nextParams.delete('reason');
      setSearchParams(nextParams, { replace: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [oauthReason, searchParams, setSearchParams, stripeOauthStatus, t]);

  const handleNotify = (notification: PaymentsNotification) => {
    if (notification.severity === 'success') {
      setSuccess(notification.message);
      setError('');
    } else {
      setError(notification.message);
      setSuccess('');
    }
  };

  if (user?.role !== 'owner') {
    return <Navigate to="/appointments" replace />;
  }

  return (
    <AppPage title={t('common.payments')} maxWidth={900}>
      <Stack spacing={2.5}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}
        {success ? <AppStatusMessage severity="success" message={success} /> : null}
        <PaymentsSettingsTab copy={paymentsCopy} accessToken={accessToken} onNotify={handleNotify} />
      </Stack>
    </AppPage>
  );
}
