import type { ChangeEvent } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField } from '@mui/material';
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
  availableWebUsers: Array<{ id: number; email: string }>;
  onClose: () => void;
  onSubmit: (payload: { userId?: number; name?: string; isActive: boolean }) => Promise<void> | void;
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
  availableWebUsers,
  onClose,
  onSubmit,
}: SpecialistFormDialogProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(editingSpecialist?.name ?? '');
    setIsActive(editingSpecialist?.isActive ?? true);
    setSelectedUserId(0);
  }, [editingSpecialist, open]);

  const handleSubmit = async () => {
    if (editingSpecialist && !name.trim()) {
      return;
    }

    if (!editingSpecialist && !selectedUserId) {
      return;
    }

    await onSubmit(editingSpecialist ? { name: name.trim(), isActive } : { userId: selectedUserId, isActive: true });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {editingSpecialist ? (
          <TextField
            margin="dense"
            fullWidth
            label={nameLabel}
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          />
        ) : (
          <FormControl margin="dense" fullWidth>
            <InputLabel id="specialist-user-select-label">{nameLabel}</InputLabel>
            <Select
              labelId="specialist-user-select-label"
              label={nameLabel}
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(Number(event.target.value))}
            >
              {availableWebUsers.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={isActive} disabled={!editingSpecialist} onChange={(event) => setIsActive(event.target.checked)} />}
          label={activeLabel}
        />
      </DialogContent>
      <DialogActions>
        <AppButton variant="text" onClick={onClose}>{closeLabel}</AppButton>
        <AppButton
          onClick={() => void handleSubmit()}
          isLoading={isSaving}
          disabled={editingSpecialist ? !name.trim() : !selectedUserId}
        >
          {saveLabel}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}
