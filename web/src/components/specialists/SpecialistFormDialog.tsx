import type { ChangeEvent } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import type { SpecialistManagementItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';

type SpecialistFormDialogProps = {
  open: boolean;
  isSaving: boolean;
  editingSpecialist: SpecialistManagementItem | null;
  title: string;
  saveLabel: string;
  closeLabel: string;
  nameLabel: string;
  activeLabel: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; isActive: boolean }) => Promise<void> | void;
};

export function SpecialistFormDialog({
  open,
  isSaving,
  editingSpecialist,
  title,
  saveLabel,
  closeLabel,
  nameLabel,
  activeLabel,
  onClose,
  onSubmit,
}: SpecialistFormDialogProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(editingSpecialist?.name ?? '');
    setIsActive(editingSpecialist?.isActive ?? true);
  }, [editingSpecialist, open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    await onSubmit({ name: name.trim(), isActive });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          fullWidth
          label={nameLabel}
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        />
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />}
          label={activeLabel}
        />
      </DialogContent>
      <DialogActions>
        <AppButton variant="text" onClick={onClose}>{closeLabel}</AppButton>
        <AppButton onClick={() => void handleSubmit()} isLoading={isSaving} disabled={!name.trim()}>{saveLabel}</AppButton>
      </DialogActions>
    </Dialog>
  );
}
