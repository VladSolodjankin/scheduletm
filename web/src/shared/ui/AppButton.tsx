import { Button, type ButtonProps } from '@mui/material';

export function AppButton(props: ButtonProps) {
  const { variant = 'contained', ...rest } = props;
  return <Button variant={variant} {...rest} />;
}
