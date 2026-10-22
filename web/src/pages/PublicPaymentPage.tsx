import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { publicPaymentsApi } from '../shared/api/client';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PublicPaymentDetails } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import { AppSurface } from '../shared/ui/AppSurface';
import { formatMoney } from '../shared/utils/money';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 10;

type LoadState = 'loading' | 'ready' | 'not_found' | 'expired' | 'error';

function PayPageFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 2,
        py: { xs: 3, sm: 6 },
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 480 }}>
        <Typography component="p" variant="h5" sx={{ fontWeight: 700, textAlign: 'center' }}>
          {t('common.appTitle')}
        </Typography>
        {children}
      </Stack>
    </Box>
  );
}

export function PublicPaymentPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const returnStatus = searchParams.get('status');
  const [details, setDetails] = useState<PublicPaymentDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    publicPaymentsApi.get(token)
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setDetails(response.data);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }
        const status = isAxiosError(error) ? error.response?.status : undefined;
        setLoadState(status === 404 ? 'not_found' : status === 410 ? 'expired' : 'error');
      });

    return () => {
      isCancelled = true;
    };
  }, [token, reloadKey]);

  const isConfirmingPayment = returnStatus === 'success' && loadState === 'ready' && details !== null && !details.appointment.isPaid;

  useEffect(() => {
    if (!isConfirmingPayment) {
      return undefined;
    }
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      publicPaymentsApi.get(token)
        .then((response) => setDetails(response.data))
        .catch(() => undefined);
      if (attempts >= POLL_MAX_ATTEMPTS) {
        window.clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isConfirmingPayment, token]);

  const startCheckout = useCallback(async () => {
    setIsRedirecting(true);
    setCheckoutError('');
    try {
      const response = await publicPaymentsApi.checkout(token);
      window.location.assign(response.data.redirectUrl);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === 404) {
        setLoadState('not_found');
      } else if (status === 410) {
        setLoadState('expired');
      } else if (status === 409) {
        setDetails((prev) => (prev ? { ...prev, canPayOnline: false } : prev));
        setCheckoutError(`${t('payPage.unavailableTitle')}. ${t('payPage.unavailableDescription')}`);
      } else {
        setCheckoutError(t('payPage.checkoutError'));
      }
      setIsRedirecting(false);
    }
  }, [t, token]);

  if (loadState === 'loading') {
    return (
      <PayPageFrame>
        <AppLoadingState lines={3} />
      </PayPageFrame>
    );
  }

  if (loadState === 'not_found') {
    return (
      <PayPageFrame>
        <AppEmptyState title={t('payPage.notFoundTitle')} description={t('payPage.notFoundDescription')} />
      </PayPageFrame>
    );
  }

  if (loadState === 'expired') {
    return (
      <PayPageFrame>
        <AppEmptyState title={t('payPage.expiredTitle')} description={t('payPage.expiredDescription')} />
      </PayPageFrame>
    );
  }

  if (loadState === 'error' || !details) {
    return (
      <PayPageFrame>
        <AppEmptyState
          title={t('payPage.loadError')}
          action={<AppButton onClick={() => {
            setLoadState('loading');
            setReloadKey((key) => key + 1);
          }}>{t('payPage.retry')}</AppButton>}
        />
      </PayPageFrame>
    );
  }

  const { appointment, canPayOnline, manual } = details;
  const amountLabel = formatMoney(appointment.amount, appointment.currency, locale);
  const scheduledLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' })
    .format(new Date(appointment.scheduledAt));
  const hasManual = Boolean(manual.bankTransfer || manual.customLink || manual.cash);
  const canShowPayment = !appointment.isPaid && returnStatus !== 'success';

  return (
    <PayPageFrame>
      {returnStatus === 'success' ? (
        <AppStatusMessage severity="success" message={`${t('payPage.successTitle')} ${appointment.isPaid ? t('payPage.successDescription') : t('payPage.confirming')}`} />
      ) : null}
      {returnStatus === 'fail' ? (
        <AppStatusMessage severity="error" message={`${t('payPage.failTitle')} ${t('payPage.failDescription')}`} />
      ) : null}

      <AppSurface>
        <Stack spacing={2.5}>
          <Typography variant="h6" component="h1">
            {t('payPage.heading')}
          </Typography>

          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {appointment.serviceName}
            </Typography>
            <Stack spacing={0.25}>
              <Typography variant="caption" color="text.secondary">
                {t('payPage.dateTime')}
              </Typography>
              <Typography variant="body2">{scheduledLabel}</Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography variant="caption" color="text.secondary">
                {t('payPage.amount')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {amountLabel}
              </Typography>
            </Stack>
          </Stack>

          {appointment.isPaid ? (
            <AppStatusMessage severity="success" message={`${t('payPage.alreadyPaidTitle')}. ${t('payPage.alreadyPaidDescription')}`} />
          ) : null}

          {canShowPayment && canPayOnline ? (
            <AppButton fullWidth size="large" isLoading={isRedirecting} onClick={() => void startCheckout()}>
              {isRedirecting ? t('payPage.redirecting') : t('payPage.payAction').replace('{amount}', amountLabel)}
            </AppButton>
          ) : null}

          {checkoutError ? <AppStatusMessage severity="error" message={checkoutError} /> : null}

          {canShowPayment && hasManual ? (
            <>
              {canPayOnline ? <Divider /> : null}
              <Stack spacing={2}>
                {canPayOnline ? (
                  <Typography variant="subtitle2" component="h2">
                    {t('payPage.otherWays')}
                  </Typography>
                ) : null}

                {manual.bankTransfer ? (
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" component="h3">
                      {t('payPage.bankTransfer')}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {manual.bankTransfer.text}
                    </Typography>
                  </Stack>
                ) : null}

                {manual.customLink ? (
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" component="h3">
                      {manual.customLink.title}
                    </Typography>
                    <Link
                      href={manual.customLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {t('payPage.openLink').replace('{title}', manual.customLink.title)}
                    </Link>
                  </Stack>
                ) : null}

                {manual.cash ? (
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" component="h3">
                      {t('payPage.cash')}
                    </Typography>
                    {manual.cash.comment ? (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {manual.cash.comment}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </>
          ) : null}

          {canShowPayment && !canPayOnline && !hasManual ? (
            <AppStatusMessage severity="warning" message={t('payPage.noMethods')} />
          ) : null}
        </Stack>
      </AppSurface>
    </PayPageFrame>
  );
}
