import { Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, type DialogProps } from '@mui/material';
import type { ReactNode } from 'react';
import { AppButton } from './AppButton';

type AppDialogProps = DialogProps & {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AppDialog({ title, description, children, actions, ...props }: AppDialogProps) {
  return (
    <Dialog fullWidth {...props}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
          {children}
        </Stack>
      </DialogContent>
      {actions ? <DialogActions sx={{ px: 3, py: 2 }}>{actions}</DialogActions> : null}
    </Dialog>
  );
}

type AppConfirmDialogProps = Omit<AppDialogProps, 'actions' | 'children'> & {
  cancelLabel: string;
  confirmLabel: string;
  confirmColor?: 'primary' | 'error' | 'secondary' | 'info' | 'success' | 'warning';
  isLoading?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export function AppConfirmDialog({
  cancelLabel,
  confirmLabel,
  confirmColor,
  isLoading = false,
  disabled = false,
  onCancel,
  onConfirm,
  children,
  ...props
}: AppConfirmDialogProps) {
  return (
    <AppDialog
      {...props}
      actions={(
        <>
          <AppButton variant="text" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </AppButton>
          <AppButton color={confirmColor} onClick={onConfirm} isLoading={isLoading} disabled={disabled}>
            {confirmLabel}
          </AppButton>
        </>
      )}
    >
      {children}
    </AppDialog>
  );
}
