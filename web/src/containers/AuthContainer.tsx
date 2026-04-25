import { Alert, Box, Divider, Link, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import logoText from '../static/images/logo_text.svg';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { AuthResponse, RegisterResponse, VerifyEmailResponse } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';

type AuthMode = 'login' | 'register';

type AuthContainerProps = {
  mode: AuthMode;
};

type VerifyEmailFormValues = {
  code: string;
};

type RegisterStep = 'credentials' | 'otp';

const REGISTER_PENDING_EMAIL_KEY = 'meetli_register_pending_email';

export function AuthContainer({ mode }: AuthContainerProps) {
  const navigate = useNavigate();
  const { setAuthSession } = useAuth();
  const { t } = useI18n();

  const isLogin = mode === 'login';

  const withEmail = (template: string, email: string) => template.replace('{email}', email);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [registerStep, setRegisterStep] = useState<RegisterStep>('credentials');
  const [pendingEmail, setPendingEmail] = useState('');

  const {
    control: verifyEmailControl,
    handleSubmit: handleVerifyEmailSubmit,
    setError: setVerifyEmailFormError,
    clearErrors: clearVerifyEmailErrors,
  } = useForm<VerifyEmailFormValues>({
    defaultValues: {
      code: '',
    },
  });

  useEffect(() => {
    if (isLogin) {
      return;
    }

    const savedPendingEmail = window.sessionStorage.getItem(REGISTER_PENDING_EMAIL_KEY);
    if (!savedPendingEmail) {
      return;
    }

    setPendingEmail(savedPendingEmail);
    setRegisterStep('otp');
    setInfo(withEmail(t('auth.registerOtpRestoreHint'), savedPendingEmail));
  }, [isLogin, t]);

  useEffect(() => {
    if (!fieldErrors.code) {
      return;
    }

    setVerifyEmailFormError('code', {
      type: 'server',
      message: fieldErrors.code,
    });
  }, [fieldErrors.code, setVerifyEmailFormError]);

  const submitCredentials = async ({ email, password }: { email: string; password: string }) => {
    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      if (isLogin) {
        const response = await apiClient.post<AuthResponse>(endpoint, { email, password, timezone });
        setError('');
        setInfo('');
        setFieldErrors({});
        setAuthSession(response.data.accessToken, response.data.user);
        navigate('/settings');
        return;
      }

      const response = await apiClient.post<RegisterResponse>(endpoint, { email, password, timezone });
      setError('');
      setFieldErrors({});
      setPendingEmail(response.data.user.email);
      window.sessionStorage.setItem(REGISTER_PENDING_EMAIL_KEY, response.data.user.email);
      setRegisterStep('otp');
      setInfo(withEmail(t('auth.registerOtpSentHint'), response.data.user.email));
    } catch (err) {
      const fallbackMessage = isLogin ? t('auth.errors.loginFailed') : t('auth.errors.registerFailed');
      const resolvedError = resolveApiError(err, {
        fallbackMessage,
        networkMessage: t('common.errors.network')
      });

      setError(resolvedError.message);
      setInfo('');
      setFieldErrors(resolvedError.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitOtp = async ({ code }: VerifyEmailFormValues) => {
    if (!pendingEmail) {
      setError(t('auth.errors.registerFailed'));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<VerifyEmailResponse>('/api/auth/verify-email', {
        email: pendingEmail,
        code,
      });

      setError('');
      setFieldErrors({});
      setInfo(response.data.message);
      window.sessionStorage.removeItem(REGISTER_PENDING_EMAIL_KEY);
      navigate('/login');
    } catch (err) {
      const resolvedError = resolveApiError(err, {
        fallbackMessage: t('auth.errors.verifyFailed'),
        networkMessage: t('common.errors.network')
      });

      setError(resolvedError.message);
      setFieldErrors(resolvedError.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!pendingEmail) {
      return;
    }

    setIsResending(true);

    try {
      const response = await apiClient.post<VerifyEmailResponse>('/api/auth/resend-verification-code', {
        email: pendingEmail,
      });
      setError('');
      setInfo(response.data.message);
    } catch (err) {
      const resolvedError = resolveApiError(err, {
        fallbackMessage: t('auth.errors.verifyResendFailed'),
        networkMessage: t('common.errors.network')
      });
      setError(resolvedError.message);
    } finally {
      setIsResending(false);
    }
  };

  const backToRegister = () => {
    setRegisterStep('credentials');
    setError('');
    setInfo('');
    setFieldErrors({});
    clearVerifyEmailErrors();
    window.sessionStorage.removeItem(REGISTER_PENDING_EMAIL_KEY);
    setPendingEmail('');
  };

  const authCardTitle = useMemo(() => (isLogin ? t('auth.formLoginTitle') : t('auth.formRegisterTitle')), [isLogin, t]);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 }
      }}
    >
      <Stack spacing={{ xs: 3, sm: 4 }} sx={{ width: '100%', maxWidth: 840, alignItems: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
          <Stack spacing={1.25}>
            <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
            </Typography>
            <Typography color="text.secondary" variant="body1">
              {isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
            </Typography>
          </Stack>
        </Box>

        {error && (
          <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {info && (
          <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
            <Alert severity="info">{info}</Alert>
          </Box>
        )}

        {!isLogin && registerStep === 'otp' ? (
          <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
            <AppForm
              component="form"
              onSubmit={handleVerifyEmailSubmit(submitOtp)}
              sx={{
                borderColor: 'divider',
                px: { xs: 2.5, sm: 4 },
                py: { xs: 3, sm: 4 },
                boxShadow: (theme) =>
                  theme.palette.mode === 'light'
                    ? '0 20px 50px rgba(15, 23, 42, 0.08)'
                    : '0 20px 50px rgba(0, 0, 0, 0.35)'
              }}
              stackProps={{ spacing: 2.5 }}
            >
              <Stack spacing={2}>
                <Box
                  component="img"
                  src={logoText}
                  alt="Meetli"
                  sx={{ height: { xs: 28, sm: 32 }, width: 'auto', alignSelf: 'flex-start' }}
                />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {t('auth.verifyTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {withEmail(t('auth.verifySubtitle'), pendingEmail)}
                </Typography>
              </Stack>

              <Controller
                name="code"
                control={verifyEmailControl}
                rules={{
                  required: t('auth.verifyCodeRequired'),
                  minLength: {
                    value: 8,
                    message: t('auth.verifyCodeInvalid')
                  }
                }}
                render={({ field, fieldState }: any) => (
                  <AppRhfTextField
                    field={field}
                    label={t('auth.verifyCodeLabel')}
                    type="text"
                    onValueChange={() => {
                      clearVerifyEmailErrors('code');
                      setFieldErrors((prev) => ({ ...prev, code: '' }));
                    }}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <AppButton type="button" variant="outlined" onClick={backToRegister} fullWidth>
                  {t('auth.verifyBack')}
                </AppButton>
                <AppButton type="button" variant="text" onClick={resendCode} isLoading={isResending} fullWidth>
                  {t('auth.verifyResend')}
                </AppButton>
                <AppButton type="submit" variant="contained" isLoading={isSubmitting} fullWidth>
                  {t('auth.verifySubmit')}
                </AppButton>
              </Stack>

              <Divider />

              <AppButton variant="text" onClick={() => navigate('/login')}>
                {t('auth.switchToLogin')}
              </AppButton>

              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                By continuing, you agree to our <Link underline="hover">terms</Link> and <Link underline="hover">privacy policy</Link>.
              </Typography>
            </AppForm>
          </Box>
        ) : (
          <AuthCard
            title={authCardTitle}
            emailLabel={t('common.email')}
            passwordLabel={t('common.password')}
            submitText={isLogin ? t('auth.submitLogin') : t('auth.submitRegister')}
            switchText={isLogin ? t('auth.switchToRegister') : t('auth.switchToLogin')}
            isSubmitting={isSubmitting}
            fieldErrors={{ email: fieldErrors.email, password: fieldErrors.password }}
            onSubmit={submitCredentials}
            onSwitch={() => navigate(isLogin ? '/register' : '/login')}
          />
        )}
      </Stack>
    </Box>
  );
}
