import { Button, CircularProgress, Stack, type ButtonProps } from '@mui/material';

type AppButtonProps = ButtonProps & {
  isLoading?: boolean;
};

export function AppButton(props: AppButtonProps) {
  const { variant = 'contained', isLoading = false, disabled, children, ...rest } = props;

  return (
    <Button variant={variant} disabled={disabled || isLoading} {...rest}>
      {isLoading ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} color="inherit" />
          <span>{children}</span>
        </Stack>
      ) : (
        children
      )}
    </Button>
  );
}
