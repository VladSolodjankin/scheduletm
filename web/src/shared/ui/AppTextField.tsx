import { TextField, type TextFieldProps } from '@mui/material';

export function AppTextField(props: TextFieldProps) {
  const { className, ...rest } = props;
  return <TextField fullWidth size="small" className={['app-field', className].filter(Boolean).join(' ')} {...rest} />;
}
