import { Alert, Box, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import logoText from '../static/images/logo_text.svg';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useI18n } from '../shared/i18n/I18nContext';
import type { VerifyEmailResponse } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';

type InviteAcceptFormValues = {
  email: string;
  password: string;
};

export function InviteAcceptContainer() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const presetEmail = useMemo(() => searchParams.get('email')?.trim() ?? '', [searchParams]);

  const { control, handleSubmit } = useForm<InviteAcceptFormValues>({
    defaultValues: {
      email: presetEmail,
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setError(t('auth.inviteTokenInvalid'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<VerifyEmailResponse>('/api/auth/accept-invite', {
        email: values.email.trim(),
        token,
        password: values.password,
      });
      setError('');
      setInfo(response.data.message || t('auth.inviteAcceptedSuccess'));
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      const resolvedError = resolveApiError(err, {
        fallbackMessage: t('auth.errors.verifyFailed'),
        networkMessage: t('common.errors.network'),
      });
      setError(resolvedError.message);
      setInfo('');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Box sx={{ width: '100%', minHeight: '100dvh', display: 'flex', justifyContent: 'center', px: { xs: 2, sm: 3 }, py: { xs: 4, sm: 6 } }}>
      <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
        <AppForm component="form" onSubmit={onSubmit} stackProps={{ spacing: 2.5 }}>
          <Stack spacing={1.25}>
            <Box component="img" src={logoText} alt="Meetli" sx={{ height: 32, width: 'auto', alignSelf: 'flex-start' }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{t('auth.inviteAcceptTitle')}</Typography>
            <Typography color="text.secondary" variant="body2">{t('auth.inviteAcceptSubtitle')}</Typography>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}

          {!token && <Alert severity="warning">{t('auth.inviteTokenInvalid')}</Alert>}

          <Controller
            name="email"
            control={control}
            render={({ field }) => <AppRhfTextField field={field} label={t('common.email')} type="email" />}
          />
          <Controller
            name="password"
            control={control}
            render={({ field }) => <AppRhfTextField field={field} label={t('common.password')} type="password" />}
          />

          <AppButton type="submit" isLoading={isSubmitting} disabled={!token}>
            {t('auth.inviteAcceptSubmit')}
          </AppButton>
        </AppForm>
      </Box>
    </Box>
  );
}
