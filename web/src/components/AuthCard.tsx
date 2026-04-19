import { Box, Button, Stack, TextField, Typography } from '@mui/material';

type AuthCardProps = {
  title: string;
  email: string;
  password: string;
  submitText: string;
  switchText: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onSwitch: () => void;
};

export function AuthCard(props: AuthCardProps) {
  return (
    <Box sx={{ maxWidth: 460, mx: 'auto', mt: 8 }}>
      <Stack spacing={2} sx={{ p: 3, borderRadius: 2, boxShadow: 2, bgcolor: 'background.paper' }}>
        <Typography variant="h5">{props.title}</Typography>
        <TextField
          label="Email"
          type="email"
          value={props.email}
          onChange={(event) => props.onEmailChange(event.target.value)}
          fullWidth
        />
        <TextField
          label="Пароль"
          type="password"
          inputProps={{ minLength: 10 }}
          value={props.password}
          onChange={(event) => props.onPasswordChange(event.target.value)}
          fullWidth
        />
        <Button variant="contained" onClick={props.onSubmit}>
          {props.submitText}
        </Button>
        <Button variant="text" onClick={props.onSwitch}>
          {props.switchText}
        </Button>
      </Stack>
    </Box>
  );
}
