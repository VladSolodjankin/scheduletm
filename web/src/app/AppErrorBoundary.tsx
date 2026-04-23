import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled application error', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2
          }}
        >
          <Stack spacing={2} sx={{ maxWidth: 560, width: '100%' }}>
            <Typography variant="h4">Что-то пошло не так</Typography>
            <Typography color="text.secondary">
              Произошла непредвиденная ошибка интерфейса. Попробуйте перезагрузить страницу.
            </Typography>
            <Alert severity="error">Если проблема повторяется, обратитесь к администратору.</Alert>
            <Button variant="contained" onClick={this.handleReload}>
              Перезагрузить страницу
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
