import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import logoText from '../static/images/logo_text.svg';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { APP_SIZING } from '../shared/theme/constants';
import { AppTextField } from '../shared/ui/AppTextField';

type AuthCardProps = {
  title: string;
  email: string;
  password: string;
  submitText: string;
  switchText: string;
  emailLabel: string;
  passwordLabel: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onSwitch: () => void;
};

export function AuthCard(props: AuthCardProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
      <AppForm
        sx={{
          borderRadius: APP_SIZING.radiusLg,
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
            {props.title}
          </Typography>
        </Stack>

        <AppTextField
          label={props.emailLabel}
          type="email"
          value={props.email}
          onChange={(event) => props.onEmailChange(event.target.value)}
        />

        <AppTextField
          label={props.passwordLabel}
          type="password"
          inputProps={{ minLength: 10 }}
          value={props.password}
          onChange={(event) => props.onPasswordChange(event.target.value)}
        />

        <AppButton variant="contained" onClick={props.onSubmit} sx={{ minHeight: 46 }}>
          {props.submitText}
        </AppButton>

        <Divider />

        <AppButton variant="text" onClick={props.onSwitch}>
          {props.switchText}
        </AppButton>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          By continuing, you agree to our <Link underline="hover">terms</Link> and <Link underline="hover">privacy policy</Link>.
        </Typography>
      </AppForm>
    </Box>
  );
}
