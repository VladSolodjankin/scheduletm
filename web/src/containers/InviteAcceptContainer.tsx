import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logoText from '../static/images/logo_text.svg';
import { apiClient } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useI18n } from '../shared/i18n/I18nContext';
import type { InviteVerifyResponse, VerifyEmailResponse } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppRhfPasswordField } from '../shared/ui/AppRhfPasswordField';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';
import { AppTextField } from '../shared/ui/AppTextField';
import { AppLink } from '../shared/ui/AppLink';

type InviteAcceptFormValues = {
  firstName: string;
  lastName: string;
  telegramUsername: string;
  password: string;
  passwordConfirm: string;
};

type InviteState =
  | { status: 'loading' }
  | {
      status: 'valid';
      email: string;
      accountName: string;
      firstName: string;
      lastName: string;
    }
  | { status: 'invalid' };

function isStrongPassword(password: string): boolean {
  return password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

export function InviteAcceptContainer() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingInvite, setIsRequestingInvite] = useState(false);
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' });

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const fallbackEmail = useMemo(() => searchParams.get('email')?.trim() ?? '', [searchParams]);
  const inviterName = useMemo(() => searchParams.get('inviter')?.trim() ?? '', [searchParams]);
  const teamName = useMemo(() => searchParams.get('team')?.trim() ?? '', [searchParams]);

  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<InviteAcceptFormValues>({
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      telegramUsername: '',
      password: '',
      passwordConfirm: '',
    },
  });

  const passwordValue = useWatch({ control, name: 'password' });

  useEffect(() => {
    let isDisposed = false;

    const verifyInvite = async () => {
      setInviteState({ status: 'loading' });

      if (!token || !fallbackEmail) {
        setInviteState({ status: 'invalid' });
        return;
      }

      try {
        const response = await apiClient.get<InviteVerifyResponse>('/api/auth/verify-invite', {
          params: {
            email: fallbackEmail,
            token,
          },
        });

        if (isDisposed) {
          return;
        }

        const invite = response.data.invite;
        setInviteState({
          status: 'valid',
          email: invite.email,
          accountName: invite.accountName || t('auth.inviteFallbackTeamName'),
          firstName: invite.firstName || '',
          lastName: invite.lastName || '',
        });
      } catch {
        if (isDisposed) {
          return;
        }

        setInviteState({ status: 'invalid' });
      }
    };

    void verifyInvite();

    return () => {
      isDisposed = true;
    };
  }, [fallbackEmail, t, token]);

  const onSubmit = handleSubmit(async (values) => {
    if (inviteState.status !== 'valid') {
      return;
    }

    if (!isStrongPassword(values.password)) {
      setError(t('auth.inviteWeakPassword'));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<VerifyEmailResponse>('/api/auth/accept-invite', {
        email: inviteState.email,
        token,
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        telegramUsername: values.telegramUsername.trim(),
      });
      setError('');
      setInfo(response.data.message || t('auth.inviteAcceptedSuccess'));
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const resolvedError = resolveApiError(err, {
        fallbackMessage: t('auth.errors.verifyFailed'),
        networkMessage: t('common.errors.network'),
      });

      setError(resolvedError.message || t('auth.inviteServerError'));
      setInfo('');
    } finally {
      setIsSubmitting(false);
    }
  });

  const requestNewInvite = async () => {
    if (inviteState.status !== 'valid' && !fallbackEmail) {
      return;
    }

    setIsRequestingInvite(true);

    try {
      const email = inviteState.status === 'valid' ? inviteState.email : fallbackEmail;
      const response = await apiClient.post<VerifyEmailResponse>('/api/auth/resend-verification-code', { email });
      setError('');
      setInfo(response.data.message);
    } catch (err) {
      const resolvedError = resolveApiError(err, {
        fallbackMessage: t('auth.inviteServerError'),
        networkMessage: t('common.errors.network'),
      });
      setError(resolvedError.message);
      setInfo('');
    } finally {
      setIsRequestingInvite(false);
    }
  };

  const inviterContext = useMemo(() => {
    if (inviterName && teamName) {
      return t('auth.inviteContextFromInviter')
        .replace('{inviter}', inviterName)
        .replace('{team}', teamName);
    }

    if (inviteState.status === 'valid') {
      return t('auth.inviteContextFallback').replace('{team}', inviteState.accountName);
    }

    return t('auth.inviteContextGeneric');
  }, [inviteState, inviterName, teamName, t]);

  return (
    <Box className="app-auth-shell app-auth-shell--invite">
      <Box className="app-auth-shell__panel app-auth-shell__panel--wide">
        <AppForm component="form" onSubmit={onSubmit} className="app-auth-card" stackProps={{ className: 'app-auth-card__body' }}>
          <Stack className="app-auth-card__header">
            <Box component="img" src={logoText} alt="Meetli" className="app-auth-card__logo" />
            <Typography variant="h4" className="app-auth-card__title">{t('auth.inviteVerifyTitle')}</Typography>
            <Typography variant="body2" className="app-auth-card__subtitle">{inviterContext}</Typography>
          </Stack>

          {inviteState.status === 'loading' && (
            <Stack direction="row" className="app-auth-card__loading">
              <CircularProgress size="var(--app-icon-m)" />
              <Typography variant="body2" className="app-auth-card__subtitle">{t('auth.inviteLoading')}</Typography>
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}

          {inviteState.status === 'invalid' && (
            <Stack className="app-auth-card__invalid">
              <Alert severity="warning">
                <Typography variant="subtitle2">{t('auth.inviteInvalidTitle')}</Typography>
                <Typography variant="body2">{t('auth.inviteInvalidText')}</Typography>
              </Alert>
              <AppButton type="button" variant="outlined" onClick={requestNewInvite} isLoading={isRequestingInvite} disabled={!fallbackEmail}>
                {t('auth.inviteRequestNew')}
              </AppButton>
            </Stack>
          )}

          {inviteState.status === 'valid' && (
            <>
              <Controller
                name="firstName"
                control={control}
                rules={{ required: t('users.form.firstName') }}
                render={({ field }) => (
                  <AppRhfTextField
                    field={field}
                    label={t('users.form.firstName')}
                    error={Boolean(errors.firstName)}
                    helperText={errors.firstName?.message}
                  />
                )}
              />

              <Controller
                name="lastName"
                control={control}
                rules={{ required: t('users.form.lastName') }}
                render={({ field }) => (
                  <AppRhfTextField
                    field={field}
                    label={t('users.form.lastName')}
                    error={Boolean(errors.lastName)}
                    helperText={errors.lastName?.message}
                  />
                )}
              />

              <AppTextField
                label={t('common.email')}
                type="email"
                value={inviteState.email}
                disabled
              />

              <Controller
                name="telegramUsername"
                control={control}
                render={({ field }) => <AppRhfTextField field={field} label={t('users.form.telegram')} />}
              />

              <Controller
                name="password"
                control={control}
                rules={{
                  required: t('common.password'),
                  validate: (value) => isStrongPassword(value) || t('auth.inviteWeakPassword'),
                }}
                render={({ field }) => (
                  <AppRhfPasswordField
                    field={field}
                    label={t('common.password')}
                    autoFocus
                    error={Boolean(errors.password)}
                    helperText={errors.password?.message}
                  />
                )}
              />

              <Controller
                name="passwordConfirm"
                control={control}
                rules={{
                  required: t('auth.passwordRepeatLabel'),
                  validate: (value) => value === passwordValue || t('auth.passwordMismatch'),
                }}
                render={({ field }) => (
                  <AppRhfPasswordField
                    field={field}
                    label={t('auth.passwordRepeatLabel')}
                    error={Boolean(errors.passwordConfirm)}
                    helperText={errors.passwordConfirm?.message}
                  />
                )}
              />

              <AppButton type="submit" isLoading={isSubmitting} disabled={!isValid}>
                {t('auth.inviteCreateAccountSubmit')}
              </AppButton>

              <AppLink to="/login" underline="hover" className="app-auth-card__link">
                {t('auth.switchToLogin')}
              </AppLink>
            </>
          )}
        </AppForm>
      </Box>
    </Box>
  );
}
