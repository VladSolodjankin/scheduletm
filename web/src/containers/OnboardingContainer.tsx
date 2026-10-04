import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';

import { apiClient, authHeaders } from '../shared/api/client';
import { useApiErrorResolver } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import { AppButton } from '../shared/ui/AppButton';
import { AppSurface } from '../shared/ui/AppSurface';
import { AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import type { OnboardingStatus, OnboardingStepKey } from '../shared/types/api';

const STEP_ROUTES: Record<OnboardingStepKey, string> = {
  account: '/settings/account',
  specialist: '/specialists',
  schedule: '/specialists',
  service: '/services',
  meeting: '/settings/integrations',
  publish: '/public-pages',
  testBooking: '/public-pages',
};

export function OnboardingContainer() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { t } = useI18n();
  const theme = useTheme();
  const resolveError = useApiErrorResolver();

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingStep, setPendingStep] = useState<OnboardingStepKey | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    let isActive = true;
    apiClient.get<OnboardingStatus>('/api/onboarding', { headers: authHeaders(accessToken) })
      .then((response) => { if (isActive) {setStatus(response.data);} })
      .catch((err) => { if (isActive) {setError(resolveError(err, t('onboarding.errors.load')).message);} })
      .finally(() => { if (isActive) {setIsLoading(false);} });

    return () => { isActive = false; };
  }, [accessToken, navigate, resolveError, t]);

  const openStep = (step: OnboardingStepKey) => {
    navigate(STEP_ROUTES[step]);
  };

  const completeStep = async (step: OnboardingStepKey) => {
    if (!accessToken) {
      return;
    }

    setPendingStep(step);
    try {
      const response = await apiClient.post<OnboardingStatus>(`/api/onboarding/steps/${step}`, {}, {
        headers: authHeaders(accessToken),
      });
      setStatus(response.data);
      setError('');
    } catch (err) {
      setError(resolveError(err, t('onboarding.errors.save')).message);
    } finally {
      setPendingStep(null);
    }
  };

  const skipOnboarding = async () => {
    if (!accessToken) {
      return;
    }

    setIsDismissing(true);
    try {
      await apiClient.post('/api/onboarding/dismiss', {}, { headers: authHeaders(accessToken) });
      navigate('/settings');
    } catch (err) {
      setError(resolveError(err, t('onboarding.errors.save')).message);
    } finally {
      setIsDismissing(false);
    }
  };

  const allDone = status?.steps.every((item) => item.completed) ?? false;

  return (
    <AppPage title={t('onboarding.pageTitle')} subtitle={t('onboarding.pageSubtitle')} maxWidth={760}>
      <Stack spacing={2.5}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}

        {isLoading || !status ? (
          <AppLoadingState lines={5} />
        ) : (
          <>
            <Stack spacing={1.5}>
              {status.steps.map((item, index) => (
                <AppSurface key={item.key} sx={{ opacity: item.completed ? 0.75 : 1 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box sx={{ color: item.completed ? 'success.main' : alpha(theme.palette.text.secondary, 0.5) }}>
                      {item.completed ? <CheckCircleRounded /> : <RadioButtonUncheckedRounded />}
                    </Box>
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {index + 1}. {t(`onboarding.steps.${item.key}.title`)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(`onboarding.steps.${item.key}.description`)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <AppButton variant="outlined" size="small" onClick={() => openStep(item.key)}>
                        {t('onboarding.openStep')}
                      </AppButton>
                      {!item.completed ? (
                        <AppButton
                          size="small"
                          isLoading={pendingStep === item.key}
                          onClick={() => void completeStep(item.key)}
                        >
                          {t('onboarding.markDone')}
                        </AppButton>
                      ) : null}
                    </Stack>
                  </Stack>
                </AppSurface>
              ))}
            </Stack>

            {allDone ? (
              <AppStatusMessage severity="success" message={t('onboarding.allDone')} />
            ) : null}

            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <AppButton variant="text" isLoading={isDismissing} onClick={() => void skipOnboarding()}>
                {t('onboarding.skip')}
              </AppButton>
              <AppButton onClick={() => navigate('/settings')}>
                {t('onboarding.goToSettings')}
              </AppButton>
            </Stack>
          </>
        )}
      </Stack>
    </AppPage>
  );
}
