import { Alert, Box, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AuthCard } from '../components/AuthCard';
import { apiClient } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import type { AuthResponse } from '../shared/types/api';

type AuthMode = 'login' | 'register';

type AuthContainerProps = {
  mode: AuthMode;
};

type ApiErrorResponse = {
  message?: string;
  errors?: Record<string, string>;
};

export function AuthContainer({ mode }: AuthContainerProps) {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isLogin = mode === 'login';

  const submit = async () => {
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await apiClient.post<AuthResponse>(endpoint, { email, password });

      setAccessToken(response.data.accessToken);
      setError('');
      setFieldErrors({});
      navigate('/settings');
    } catch (err) {
      if (isAxiosError<ApiErrorResponse>(err)) {
        const apiError = err.response?.data;

        setError(apiError?.message ?? (isLogin
          ? 'Не удалось войти. Проверьте email и пароль.'
          : 'Не удалось зарегистрироваться.'));

        setFieldErrors(apiError?.errors ?? {});
        return;
      }

      setError(isLogin
        ? 'Не удалось войти. Проверьте email и пароль.'
        : 'Не удалось зарегистрироваться.');
      setFieldErrors({});
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 4, textAlign: 'center' }}>
        ScheduleTM
      </Typography>

      {error && (
        <Box sx={{ maxWidth: 460, mx: 'auto', mt: 2 }}>
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
        title={isLogin ? 'Вход' : 'Регистрация'}
        email={email}
        password={password}
        submitText={isLogin ? 'Войти' : 'Зарегистрироваться'}
        switchText={isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
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
    </Box>
  );
}
