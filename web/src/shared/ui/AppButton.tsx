import { Button, CircularProgress, Stack, type ButtonProps } from '@mui/material';

type AppButtonProps = ButtonProps & {
  isLoading?: boolean;
};

export function AppButton(props: AppButtonProps) {
  const { variant = 'contained', isLoading = false, disabled, children, className, ...rest } = props;

  return (
    <Button
      variant={variant}
      disabled={disabled || isLoading}
      className={['app-button', isLoading ? 'app-button--loading' : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {isLoading ? (
        <Stack direction="row" className="app-button__loading">
          <CircularProgress size={16} color="inherit" />
          <span>{children}</span>
        </Stack>
      ) : (
        children
      )}
    </Button>
  );
}
