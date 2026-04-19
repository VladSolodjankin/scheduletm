import { Alert, Box, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { apiClient } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';
import type { AuthResponse } from '../shared/types/api';

type AuthMode = 'login' | 'register';

type AuthContainerProps = {
  mode: AuthMode;
};

export function AuthContainer({ mode }: AuthContainerProps) {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isLogin = mode === 'login';

  const submit = async () => {
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await apiClient.post<AuthResponse>(endpoint, { email, password });
      setAccessToken(response.data.accessToken);
      setError('');
      navigate('/settings');
    } catch {
      setError(isLogin ? 'Не удалось войти. Проверьте email/пароль.' : 'Не удалось зарегистрироваться.');
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 4, textAlign: 'center' }}>
        ScheduleTM
      </Typography>
      {error && (
        <Box sx={{ maxWidth: 460, mx: 'auto', mt: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
      <AuthCard
        title={isLogin ? 'Вход' : 'Регистрация'}
        email={email}
        password={password}
        submitText={isLogin ? 'Войти' : 'Зарегистрироваться'}
        switchText={isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={submit}
        onSwitch={() => navigate(isLogin ? '/register' : '/login')}
      />
    </Box>
  );
}
