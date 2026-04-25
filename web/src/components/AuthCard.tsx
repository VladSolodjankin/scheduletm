import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import logoText from '../static/images/logo_text.svg';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppRhfPasswordField } from '../shared/ui/AppRhfPasswordField';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';

type AuthFormValues = {
  email: string;
  password: string;
};

type AuthCardProps = {
  title: string;
  submitText: string;
  switchText: string;
  emailLabel: string;
  passwordLabel: string;
  isSubmitting?: boolean;
  fieldErrors?: Partial<Record<keyof AuthFormValues, string>>;
  onSubmit: (values: AuthFormValues) => Promise<void> | void;
  onSwitch: () => void;
};

export function AuthCard({
  title,
  submitText,
  switchText,
  emailLabel,
  passwordLabel,
  isSubmitting = false,
  fieldErrors,
  onSubmit,
  onSwitch
}: AuthCardProps) {
  const { control, handleSubmit, setError, clearErrors } = useForm<AuthFormValues>({
    defaultValues: {
      email: '',
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

    if (fieldErrors.password) {
      setError('password', { type: 'server', message: fieldErrors.password });
    }
  }, [fieldErrors, setError]);

  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
      <AppForm
        component="form"
        onSubmit={handleSubmit(onSubmit)}
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
            {title}
          </Typography>
        </Stack>

        <Controller
          name="email"
          control={control}
          rules={{
            required: 'Email is required'
          }}
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

        <Controller
          name="password"
          control={control}
          rules={{
            required: 'Password is required',
            minLength: {
              value: 10,
              message: 'Password must be at least 10 characters'
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

        <AppButton type="submit" variant="contained" isLoading={isSubmitting} sx={{ minHeight: 46 }}>
          {submitText}
        </AppButton>

        <Divider />

        <AppButton variant="text" onClick={onSwitch}>
          {switchText}
        </AppButton>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          By continuing, you agree to our <Link underline="hover">terms</Link> and <Link underline="hover">privacy policy</Link>.
        </Typography>
      </AppForm>
    </Box>
  );
}
