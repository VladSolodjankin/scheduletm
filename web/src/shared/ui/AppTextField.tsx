import { TextField, type TextFieldProps } from '@mui/material';

export function AppTextField(props: TextFieldProps) {
  return <TextField fullWidth size="medium" {...props} />;
}
