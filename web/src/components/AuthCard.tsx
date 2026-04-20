import { Box, Divider, Link, Paper, Stack, Typography } from '@mui/material';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
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
    <Box sx={{ maxWidth: 460, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          p: { xs: 2.5, sm: 4 },
          bgcolor: 'background.paper'
        }}
      >
        <AppForm>
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {props.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Taplink / Meetli
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

          <AppButton variant="contained" onClick={props.onSubmit}>
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
      </Paper>
    </Box>
  );
}
