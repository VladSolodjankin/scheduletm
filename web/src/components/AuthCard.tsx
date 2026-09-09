import { Box, Divider, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import logoText from '../static/images/logo_text.svg';
import { AuthLegalNotice } from './legal/AuthLegalNotice';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppRhfPhoneField } from '../shared/ui/AppRhfPhoneField';
import { isValidPhoneValue } from '../shared/ui/phoneUtils';
import { AppRhfPasswordField } from '../shared/ui/AppRhfPasswordField';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';

type AuthFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  telegramUsername: string;
  password: string;
};

type AuthCardProps = {
  title: string;
  submitText: string;
  switchText: string;
  isLogin: boolean;
  firstNameLabel: string;
  lastNameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  telegramLabel: string;
  passwordLabel: string;
  isSubmitting?: boolean;
  fieldErrors?: Partial<Record<keyof AuthFormValues, string>>;
  requiredMessage: string;
  phoneInvalidMessage: string;
  passwordMinLengthMessage: string;
  forgotPasswordText?: string;
  onSubmit: (values: AuthFormValues) => Promise<void> | void;
  onSwitch: () => void;
  onForgotPassword?: () => void;
};

export function AuthCard({
  title,
  submitText,
  switchText,
  isLogin,
  firstNameLabel,
  lastNameLabel,
  emailLabel,
  phoneLabel,
  telegramLabel,
  passwordLabel,
  isSubmitting = false,
  fieldErrors,
  requiredMessage,
  phoneInvalidMessage,
  passwordMinLengthMessage,
  forgotPasswordText,
  onSubmit,
  onSwitch,
  onForgotPassword
}: AuthCardProps) {
  const { control, handleSubmit, setError, clearErrors } = useForm<AuthFormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      telegramUsername: '',
      password: ''
    }
  });

  useEffect(() => {
    if (!fieldErrors) {
      return;
    }

    if (fieldErrors.email) {
      setError('email', { type: 'server', message: fieldErrors.email });
    }
    if (fieldErrors.firstName) {
      setError('firstName', { type: 'server', message: fieldErrors.firstName });
    }
    if (fieldErrors.lastName) {
      setError('lastName', { type: 'server', message: fieldErrors.lastName });
    }
    if (fieldErrors.phone) {
      setError('phone', { type: 'server', message: fieldErrors.phone });
    }
    if (fieldErrors.telegramUsername) {
      setError('telegramUsername', { type: 'server', message: fieldErrors.telegramUsername });
    }

    if (fieldErrors.password) {
      setError('password', { type: 'server', message: fieldErrors.password });
    }
  }, [fieldErrors, setError]);

  return (
    <Box className="app-auth-shell__panel">
      <AppForm
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        className="app-auth-card"
        stackProps={{ className: 'app-auth-card__body' }}
      >
        <Stack className="app-auth-card__header">
          <Box
            component="img"
            src={logoText}
            alt="Meetli"
            className="app-auth-card__logo"
          />
          <Typography variant="h4" className="app-auth-card__title">
            {title}
          </Typography>
        </Stack>

        {!isLogin && (
          <>
            <Controller
              name="firstName"
              control={control}
              rules={{ required: requiredMessage }}
              render={({ field, fieldState }: any) => (
                <AppRhfTextField
                  field={field}
                  label={firstNameLabel}
                  onValueChange={() => clearErrors('firstName')}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="lastName"
              control={control}
              rules={{ required: requiredMessage }}
              render={({ field, fieldState }: any) => (
                <AppRhfTextField
                  field={field}
                  label={lastNameLabel}
                  onValueChange={() => clearErrors('lastName')}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </>
        )}

        <Controller
          name="email"
          control={control}
          rules={{ required: requiredMessage }}
          render={({ field, fieldState }: any) => (
            <AppRhfTextField
              field={field}
              label={emailLabel}
              type="email"
              onValueChange={() => clearErrors('email')}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
            />
          )}
        />

        {!isLogin && (
          <>
            <Controller
              name="phone"
              control={control}
              rules={{
                required: requiredMessage,
                validate: (value) => isValidPhoneValue(value) || phoneInvalidMessage
              }}
              render={({ field, fieldState }: any) => (
                <AppRhfPhoneField
                  field={field}
                  label={phoneLabel}
                  onValueChange={() => clearErrors('phone')}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="telegramUsername"
              control={control}
              render={({ field, fieldState }: any) => (
                <AppRhfTextField
                  field={field}
                  label={telegramLabel}
                  onValueChange={() => clearErrors('telegramUsername')}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </>
        )}

        <Controller
          name="password"
          control={control}
          rules={{
            required: requiredMessage,
            minLength: {
              value: 10,
              message: passwordMinLengthMessage
            }
          }}
          render={({ field, fieldState }: any) => (
            <AppRhfPasswordField
              field={field}
              label={passwordLabel}
              slotProps={{ htmlInput: { minLength: 10 } }}
              onValueChange={() => clearErrors('password')}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
            />
          )}
          />

        {isLogin && forgotPasswordText && onForgotPassword && (
          <AppButton
            type="button"
            variant="text"
            onClick={onForgotPassword}
            className="app-auth-card__forgot-password"
          >
            {forgotPasswordText}
          </AppButton>
        )}

        <AppButton type="submit" variant="contained" size="large" isLoading={isSubmitting}>
          {submitText}
        </AppButton>

        <Divider />

        <AppButton variant="text" onClick={onSwitch}>
          {switchText}
        </AppButton>

        <AuthLegalNotice />
      </AppForm>
    </Box>
  );
}
