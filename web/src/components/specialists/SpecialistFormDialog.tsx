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
  baseSessionPriceLabel: string;
  baseHourPriceLabel: string;
  workStartHourLabel: string;
  workEndHourLabel: string;
  slotDurationMinLabel: string;
  slotStepMinLabel: string;
  defaultSessionContinuationMinLabel: string;
  availableWebUsers: Array<{ id: number; email: string }>;
  onClose: () => void;
  onSubmit: (payload: {
    userId?: number;
    name?: string;
    isActive: boolean;
    baseSessionPrice: number;
    baseHourPrice: number;
    workStartHour: number;
    workEndHour: number;
    slotDurationMin: number;
    slotStepMin: number;
    defaultSessionContinuationMin: number;
  }) => Promise<void> | void;
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
  baseSessionPriceLabel,
  baseHourPriceLabel,
  workStartHourLabel,
  workEndHourLabel,
  slotDurationMinLabel,
  slotStepMinLabel,
  defaultSessionContinuationMinLabel,
  availableWebUsers,
  onClose,
  onSubmit,
}: SpecialistFormDialogProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [baseSessionPrice, setBaseSessionPrice] = useState(0);
  const [baseHourPrice, setBaseHourPrice] = useState(0);
  const [workStartHour, setWorkStartHour] = useState(9);
  const [workEndHour, setWorkEndHour] = useState(20);
  const [slotDurationMin, setSlotDurationMin] = useState(90);
  const [slotStepMin, setSlotStepMin] = useState(30);
  const [defaultSessionContinuationMin, setDefaultSessionContinuationMin] = useState(60);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(editingSpecialist?.name ?? '');
    setIsActive(editingSpecialist?.isActive ?? true);
    setSelectedUserId(0);
    setBaseSessionPrice(editingSpecialist?.baseSessionPrice ?? 0);
    setBaseHourPrice(editingSpecialist?.baseHourPrice ?? 0);
    setWorkStartHour(editingSpecialist?.workStartHour ?? 9);
    setWorkEndHour(editingSpecialist?.workEndHour ?? 20);
    setSlotDurationMin(editingSpecialist?.slotDurationMin ?? 90);
    setSlotStepMin(editingSpecialist?.slotStepMin ?? 30);
    setDefaultSessionContinuationMin(editingSpecialist?.defaultSessionContinuationMin ?? 60);
  }, [editingSpecialist, open]);

  const handleSubmit = async () => {
    if (editingSpecialist && !name.trim()) {
      return;
    }

    if (!editingSpecialist && !selectedUserId) {
      return;
    }

    await onSubmit(editingSpecialist
      ? { name: name.trim(), isActive, baseSessionPrice, baseHourPrice, workStartHour, workEndHour, slotDurationMin, slotStepMin, defaultSessionContinuationMin }
      : { userId: selectedUserId, isActive: true, baseSessionPrice, baseHourPrice, workStartHour, workEndHour, slotDurationMin, slotStepMin, defaultSessionContinuationMin });
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
        <TextField margin="dense" fullWidth label={baseSessionPriceLabel} type="number" value={baseSessionPrice} onChange={(e) => setBaseSessionPrice(Number(e.target.value))} />
        <TextField margin="dense" fullWidth label={baseHourPriceLabel} type="number" value={baseHourPrice} onChange={(e) => setBaseHourPrice(Number(e.target.value))} />
        <TextField margin="dense" fullWidth label={workStartHourLabel} type="number" value={workStartHour} onChange={(e) => setWorkStartHour(Number(e.target.value))} />
        <TextField margin="dense" fullWidth label={workEndHourLabel} type="number" value={workEndHour} onChange={(e) => setWorkEndHour(Number(e.target.value))} />
        <TextField margin="dense" fullWidth label={slotDurationMinLabel} type="number" value={slotDurationMin} onChange={(e) => setSlotDurationMin(Number(e.target.value))} />
        <TextField margin="dense" fullWidth label={slotStepMinLabel} type="number" value={slotStepMin} onChange={(e) => setSlotStepMin(Number(e.target.value))} />
        <TextField margin="dense" fullWidth label={defaultSessionContinuationMinLabel} type="number" value={defaultSessionContinuationMin} onChange={(e) => setDefaultSessionContinuationMin(Number(e.target.value))} />
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
