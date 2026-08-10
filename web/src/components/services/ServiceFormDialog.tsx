import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { AppButton } from '../../shared/ui/AppButton';
import type { ServiceCatalogItem, ServicePayload, ServiceSpecialist } from './types';

type Props = {
  open: boolean;
  service: ServiceCatalogItem | null;
  specialists: ServiceSpecialist[];
  isSaving: boolean;
  labels: Record<string, string>;
  onClose: () => void;
  onSubmit: (payload: ServicePayload) => void;
};

export function ServiceFormDialog({ open, service, specialists, isSaving, labels, onClose, onSubmit }: Props) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [basePrice, setBasePrice] = useState(String(service?.basePrice ?? 0));
  const [baseDurationMinutes, setBaseDurationMinutes] = useState(String(service?.baseDurationMinutes ?? 60));
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? '');
  const [firstSessionFree, setFirstSessionFree] = useState(service?.firstSessionFree ?? false);
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [specialistIds, setSpecialistIds] = useState<number[]>(() => {
    const availableSpecialistIds = new Set(specialists.map((item) => item.id));
    return service?.assignments
      .filter((item) => item.isActive && availableSpecialistIds.has(item.specialistId))
      .map((item) => item.specialistId) ?? [];
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      basePrice: Number(basePrice),
      baseDurationMinutes: Number(baseDurationMinutes),
      firstSessionFree,
      imageUrl: imageUrl.trim() || undefined,
      isActive,
      specialistIds,
    });
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{service ? labels.editTitle : labels.createTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField required label={labels.name} value={name} onChange={(event) => setName(event.target.value)} />
            <TextField multiline minRows={2} label={labels.description} value={description} onChange={(event) => setDescription(event.target.value)} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField required type="number" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} label={labels.price} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} />
              <TextField required type="number" slotProps={{ htmlInput: { min: 1, step: 1 } }} label={labels.duration} value={baseDurationMinutes} onChange={(event) => setBaseDurationMinutes(event.target.value)} />
            </Stack>
            <TextField type="url" label={labels.imageUrl} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
            <FormControlLabel control={<Checkbox checked={firstSessionFree} onChange={(event) => setFirstSessionFree(event.target.checked)} />} label={labels.firstSessionFree} />
            <FormControlLabel control={<Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />} label={labels.active} />
            <FormGroup>
              {specialists.map((specialist) => (
                <FormControlLabel
                  key={specialist.id}
                  control={<Checkbox checked={specialistIds.includes(specialist.id)} onChange={(event) => setSpecialistIds((current) => event.target.checked ? [...current, specialist.id] : current.filter((id) => id !== specialist.id))} />}
                  label={specialist.name}
                />
              ))}
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <AppButton variant="text" onClick={onClose} disabled={isSaving}>{labels.cancel}</AppButton>
          <AppButton type="submit" isLoading={isSaving} disabled={!name.trim()}>{labels.save}</AppButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
