import { Alert, Box, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AuthCard } from '../components/AuthCard';
import { apiClient } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { AuthResponse } from '../shared/types/api';

type AuthMode = 'login' | 'register';

type AuthContainerProps = {
  mode: AuthMode;
};

type ApiErrorResponse = {
  message?: string;
  errors?: Record<string, string>;
};

const GOLDEN_RATIO = 1.618;

export function AuthContainer({ mode }: AuthContainerProps) {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isLogin = mode === 'login';

  const submit = async () => {
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await apiClient.post<AuthResponse>(endpoint, { email, password });

      setError('');
      setFieldErrors({});

      if (isLogin) {
        setAccessToken(response.data.accessToken);
        navigate('/settings');
        return;
      }

      navigate('/login');
    } catch (err) {
      if (isAxiosError<ApiErrorResponse>(err)) {
        const apiError = err.response?.data;

        setError(apiError?.message ?? (isLogin
          ? t('auth.errors.loginFailed')
          : t('auth.errors.registerFailed')));

        setFieldErrors(apiError?.errors ?? {});
        return;
      }

      setError(isLogin
        ? t('auth.errors.loginFailed')
        : t('auth.errors.registerFailed'));
      setFieldErrors({});
    }
  };

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
      <Stack spacing={{ xs: 3, sm: 4 }} sx={{ width: '100%', maxWidth: 840 }}>
        <Box sx={{ width: '100%', maxWidth: `${Math.round(520 * GOLDEN_RATIO)}px`, mx: 'auto' }}>
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
            <Alert severity="error">
              {error}
              {(fieldErrors.email || fieldErrors.password) && (
                <Box component="ul" sx={{ mb: 0, mt: 1, pl: 3 }}>
                  {fieldErrors.email && <li>{fieldErrors.email}</li>}
                  {fieldErrors.password && <li>{fieldErrors.password}</li>}
                </Box>
              )}
            </Alert>
          </Box>
        )}

        <AuthCard
          title={isLogin ? t('auth.formLoginTitle') : t('auth.formRegisterTitle')}
          email={email}
          password={password}
          emailLabel={t('common.email')}
          passwordLabel={t('common.password')}
          submitText={isLogin ? t('auth.submitLogin') : t('auth.submitRegister')}
          switchText={isLogin ? t('auth.switchToRegister') : t('auth.switchToLogin')}
          onEmailChange={(value) => {
            setEmail(value);
            setFieldErrors((prev) => ({ ...prev, email: '' }));
          }}
          onPasswordChange={(value) => {
            setPassword(value);
            setFieldErrors((prev) => ({ ...prev, password: '' }));
          }}
          onSubmit={submit}
          onSwitch={() => navigate(isLogin ? '/register' : '/login')}
        />
      </Stack>
    </Box>
  );
}
