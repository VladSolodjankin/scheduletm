import { Box, Card, CardActions, CardContent, Chip, Divider, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import type { AssignmentPayload, ServiceAssignment, ServiceCatalogItem } from './types';

type Props = {
  service: ServiceCatalogItem;
  canManage: boolean;
  labels: Record<string, string>;
  onEdit: () => void;
  onDeactivate: () => void;
  onSaveAssignment: (assignment: ServiceAssignment, payload: AssignmentPayload) => void;
};

function AssignmentEditor({ assignment, canManage, labels, onSave }: {
  assignment: ServiceAssignment;
  canManage: boolean;
  labels: Record<string, string>;
  onSave: (payload: AssignmentPayload) => void;
}) {
  const [isActive, setIsActive] = useState(assignment.isActive);
  const [price, setPrice] = useState(assignment.priceOverride?.toString() ?? '');
  const [duration, setDuration] = useState(assignment.durationOverrideMinutes?.toString() ?? '');
  const canEdit = canManage || assignment.canEdit === true;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
      <Typography sx={{ minWidth: 160, fontWeight: 600 }}>{assignment.specialistName}</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexGrow: 1 }}>
        <Switch size="small" checked={isActive} disabled={!canEdit} onChange={(event) => setIsActive(event.target.checked)} slotProps={{ input: { 'aria-label': labels.active } }} />
        <TextField size="small" type="number" label={labels.priceOverride} value={price} disabled={!canEdit} onChange={(event) => setPrice(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 0.01 } }} />
        <TextField size="small" type="number" label={labels.durationOverride} value={duration} disabled={!canEdit} onChange={(event) => setDuration(event.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
        {canEdit ? <AppButton size="small" onClick={() => onSave({ isActive, priceOverride: price === '' ? null : Number(price), durationOverrideMinutes: duration === '' ? null : Number(duration) })}>{labels.save}</AppButton> : null}
      </Stack>
    </Stack>
  );
}

export function ServiceCard({ service, canManage, labels, onEdit, onDeactivate, onSaveAssignment }: Props) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <Typography variant="h6">{service.name}</Typography>
              <Chip size="small" color={service.isActive ? 'success' : 'default'} label={service.isActive ? labels.active : labels.inactive} />
              {service.firstSessionFree ? <Chip size="small" color="primary" label={labels.firstSessionFree} /> : null}
            </Stack>
            {service.description ? <Typography color="text.secondary">{service.description}</Typography> : null}
            <Typography sx={{ mt: 1 }}>{service.basePrice} · {service.baseDurationMinutes} {labels.minutes}</Typography>
          </Box>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">{labels.assignments}</Typography>
          {service.assignments.length ? service.assignments.map((assignment) => (
            <AssignmentEditor
              key={`${assignment.specialistId}:${assignment.isActive}:${assignment.priceOverride ?? ''}:${assignment.durationOverrideMinutes ?? ''}`}
              assignment={assignment}
              canManage={canManage}
              labels={labels}
              onSave={(payload) => onSaveAssignment(assignment, payload)}
            />
          )) : <Typography color="text.secondary">{labels.noAssignments}</Typography>}
        </Stack>
      </CardContent>
      {canManage ? (
        <CardActions>
          <AppButton size="small" variant="text" startIcon={<AppIcons.edit />} onClick={onEdit}>{labels.edit}</AppButton>
          {service.isActive ? <AppButton size="small" variant="text" color="error" startIcon={<AppIcons.deactivate />} onClick={onDeactivate}>{labels.deactivate}</AppButton> : null}
        </CardActions>
      ) : null}
    </Card>
  );
}
