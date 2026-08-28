import { Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, type DialogProps } from '@mui/material';
import type { ReactNode } from 'react';
import { AppButton } from './AppButton';

type AppDialogProps = DialogProps & {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AppDialog({ title, description, children, actions, className, ...props }: AppDialogProps) {
  return (
    <Dialog fullWidth className={['app-dialog', className].filter(Boolean).join(' ')} {...props}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers className="app-dialog__content">
        <Stack className="app-dialog__body">
          {description ? (
            <Typography variant="body2" className="app-dialog__description">
              {description}
            </Typography>
          ) : null}
          {children}
        </Stack>
      </DialogContent>
      {actions ? <DialogActions className="app-dialog__actions">{actions}</DialogActions> : null}
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
