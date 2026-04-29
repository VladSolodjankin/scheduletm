import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { I18nContext } from '../shared/i18n/I18nContext';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public static contextType = I18nContext;
  declare context: React.ContextType<typeof I18nContext>;
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
      const t = this.context?.t;

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
            <Typography variant="h4">{t?.('common.appErrorTitle')}</Typography>
            <Typography color="text.secondary">
              {t?.('common.appErrorDescription')}
            </Typography>
            <Alert severity="error">{t?.('common.appErrorSupport')}</Alert>
            <Button variant="contained" onClick={this.handleReload}>
              {t?.('common.appErrorReload')}
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
