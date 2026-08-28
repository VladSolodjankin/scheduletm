import ImageOutlined from '@mui/icons-material/ImageOutlined';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppTextField } from '../../shared/ui/AppTextField';
import type { AssignmentPayload, ServiceAssignment, ServiceCatalogItem } from './types';
import './services.css';

type Props = {
  service: ServiceCatalogItem;
  locale: 'en' | 'ru';
  canManage: boolean;
  labels: Record<string, string>;
  savingAssignmentId: number | null;
  isMutating: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSaveAssignment: (assignment: ServiceAssignment, payload: AssignmentPayload) => Promise<void>;
};

function formatPrice(value: number, locale: Props['locale']) {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(value: number, labels: Record<string, string>) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) {
    return `${minutes} ${labels.minutes}`;
  }
  return minutes
    ? `${hours} ${labels.hoursShort} ${minutes} ${labels.minutes}`
    : `${hours} ${labels.hoursShort}`;
}

function AssignmentEditor({
  assignment,
  service,
  canManage,
  labels,
  isSaving,
  onSave,
}: {
  assignment: ServiceAssignment;
  service: ServiceCatalogItem;
  canManage: boolean;
  labels: Record<string, string>;
  isSaving: boolean;
  onSave: (payload: AssignmentPayload) => Promise<void>;
}) {
  const [isActive, setIsActive] = useState(assignment.isActive);
  const [price, setPrice] = useState(String(assignment.priceOverride ?? service.basePrice));
  const [duration, setDuration] = useState(String(assignment.durationOverrideMinutes ?? service.baseDurationMinutes));
  const [priceInherited, setPriceInherited] = useState(assignment.priceOverride === null);
  const [durationInherited, setDurationInherited] = useState(assignment.durationOverrideMinutes === null);
  const canEdit = canManage || assignment.canEdit === true;
  const parsedPrice = Number(price);
  const parsedDuration = Number(duration);
  const priceInvalid = price === '' || !Number.isInteger(parsedPrice) || parsedPrice < 0 || parsedPrice > 10_000_000;
  const durationInvalid = duration === '' || !Number.isInteger(parsedDuration) || parsedDuration < 5 || parsedDuration > 1440;
  const dirty = isActive !== assignment.isActive
    || (priceInherited ? assignment.priceOverride !== null : parsedPrice !== assignment.priceOverride)
    || (durationInherited ? assignment.durationOverrideMinutes !== null : parsedDuration !== assignment.durationOverrideMinutes);

  const useServiceDefaults = () => {
    setPrice(String(service.basePrice));
    setDuration(String(service.baseDurationMinutes));
    setPriceInherited(true);
    setDurationInherited(true);
  };

  return (
    <Box className="service-card__assignment">
      <Stack className="service-card__assignment-content">
        <Stack
          className="service-card__assignment-header"
        >
          <Typography className="service-card__specialist-name">{assignment.specialistName}</Typography>
          <FormControlLabel
            control={(
              <Switch
                size="small"
                checked={isActive}
                disabled={!canEdit || isSaving}
                onChange={(event) => setIsActive(event.target.checked)}
              />
            )}
            label={labels.availableForBooking}
          />
        </Stack>

        <Box className="service-card__assignment-fields">
          <AppTextField
            type="number"
            label={labels.price}
            value={price}
            disabled={!canEdit || isSaving}
            error={priceInvalid}
            helperText={priceInvalid ? labels.priceError : (priceInherited ? labels.serviceDefault : labels.customValue)}
            slotProps={{ htmlInput: { min: 0, max: 10_000_000, step: 1 } }}
            onChange={(event) => {
              setPrice(event.target.value);
              setPriceInherited(false);
            }}
          />
          <AppTextField
            type="number"
            label={labels.duration}
            value={duration}
            disabled={!canEdit || isSaving}
            error={durationInvalid}
            helperText={durationInvalid ? labels.durationError : (durationInherited ? labels.serviceDefault : labels.customValue)}
            slotProps={{ htmlInput: { min: 5, max: 1440, step: 1 } }}
            onChange={(event) => {
              setDuration(event.target.value);
              setDurationInherited(false);
            }}
          />
        </Box>

        {canEdit ? (
          <Stack className="service-card__assignment-actions">
            <AppButton variant="text" size="small" disabled={isSaving} onClick={useServiceDefaults}>
              {labels.useServiceDefaults}
            </AppButton>
            <AppButton
              size="small"
              isLoading={isSaving}
              disabled={!dirty || priceInvalid || durationInvalid}
              onClick={() => void onSave({
                isActive,
                priceOverride: priceInherited ? null : parsedPrice,
                durationOverrideMinutes: durationInherited ? null : parsedDuration,
              })}
            >
              {labels.save}
            </AppButton>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

export function ServiceCard({
  service,
  locale,
  canManage,
  labels,
  savingAssignmentId,
  isMutating,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onSaveAssignment,
}: Props) {
  return (
    <Card variant="outlined" className="service-card">
      <CardContent className="service-card__content">
        <Box className="service-card__summary">
          {service.imageUrl ? (
            <Box
              component="img"
              src={service.imageUrl}
              alt={service.name}
              className="service-card__image"
            />
          ) : (
            <Box className="service-card__image-placeholder">
              <ImageOutlined />
            </Box>
          )}

          <Stack className="service-card__copy">
            <Stack className="service-card__heading">
              <Typography variant="h6" className="service-card__title">{service.name}</Typography>
              <Chip
                size="small"
                color={service.isActive ? 'success' : 'default'}
                label={service.isActive ? labels.active : labels.archived}
                className={`app-badge ${service.isActive ? 'app-badge--success' : 'app-badge--neutral'}`}
              />
              {service.firstSessionFree ? (
                <Chip size="small" color="primary" label={labels.firstSessionFree} className="app-badge" />
              ) : null}
            </Stack>
            {service.description ? <Typography className="service-card__description">{service.description}</Typography> : null}
            <Stack className="service-card__price-line">
              <Typography className="service-card__price">{formatPrice(service.basePrice, locale)}</Typography>
              <Typography className="service-card__muted">·</Typography>
              <Typography>{formatDuration(service.baseDurationMinutes, labels)}</Typography>
            </Stack>
          </Stack>
        </Box>

        <Divider className="service-card__divider" />
        <Stack className="service-card__assignments">
          <Stack className="service-card__assignments-heading">
            <Typography variant="subtitle1" className="service-card__section-title">{labels.assignments}</Typography>
            <Typography variant="body2" className="service-card__muted">{labels.assignmentsHelper}</Typography>
          </Stack>
          {service.assignments.length ? service.assignments.map((assignment) => (
            <AssignmentEditor
              key={`${assignment.specialistId}:${assignment.isActive}:${assignment.priceOverride ?? ''}:${assignment.durationOverrideMinutes ?? ''}:${service.basePrice}:${service.baseDurationMinutes}`}
              assignment={assignment}
              service={service}
              canManage={canManage}
              labels={labels}
              isSaving={savingAssignmentId === assignment.specialistId}
              onSave={(payload) => onSaveAssignment(assignment, payload)}
            />
          )) : <Typography className="service-card__muted">{labels.noAssignments}</Typography>}
        </Stack>
      </CardContent>

      {canManage ? (
        <CardActions className="service-card__actions">
          <AppButton size="small" variant="text" startIcon={<AppIcons.edit />} disabled={isMutating} onClick={onEdit}>
            {labels.edit}
          </AppButton>
          <AppButton
            size="small"
            variant="text"
            startIcon={service.isActive ? <AppIcons.deactivate /> : undefined}
            disabled={isMutating}
            onClick={service.isActive ? onArchive : onRestore}
          >
            {service.isActive ? labels.archive : labels.restore}
          </AppButton>
          <AppButton
            size="small"
            variant="text"
            color="error"
            startIcon={<AppIcons.delete />}
            disabled={isMutating}
            onClick={onDelete}
          >
            {labels.deletePermanently}
          </AppButton>
        </CardActions>
      ) : null}
    </Card>
  );
}
