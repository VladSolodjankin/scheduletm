import { Box, Typography } from '@mui/material';
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
      <AppForm>
        <Typography variant="h5">{props.title}</Typography>

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

        <AppButton variant="text" onClick={props.onSwitch}>
          {props.switchText}
        </AppButton>
      </AppForm>
    </Box>
  );
}
