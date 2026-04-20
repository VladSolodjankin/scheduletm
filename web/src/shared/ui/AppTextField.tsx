import { TextField, type TextFieldProps } from '@mui/material';

type Props = TextFieldProps & {
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

export function AppTextField(props: Props) {
  return <TextField fullWidth size="medium" {...props} />;
}
