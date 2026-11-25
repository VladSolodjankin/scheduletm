import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import { Box, Checkbox, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { AppButton } from '../../shared/ui/AppButton';
import { AppAvatar } from '../../shared/ui/AppList';
import { AppStatusBadge } from '../../shared/ui/AppStatus';
import { AppTextField } from '../../shared/ui/AppTextField';
import { formatMoney } from '../../shared/utils/money';
import { formatServiceDuration } from './format';
import type { AssignmentPayload, ServiceAssignment } from './types';
import { useI18n } from '../../shared/i18n/I18nContext';

const MAX_PRICE = 10_000_000;
const MIN_DURATION = 5;
const MAX_DURATION = 1440;

export type AssignmentDraft = {
  specialistId: number;
  specialistName: string;
  canEdit: boolean;
  enabled: boolean;
  editing: boolean;
  priceText: string;
  durationText: string;
  original: ServiceAssignment | null;
};

export function createAssignmentDraft(
  specialistId: number,
  specialistName: string,
  assignment: ServiceAssignment | null,
  enabled: boolean,
  canEdit: boolean,
): AssignmentDraft {
  const priceText = assignment?.priceOverride === null || assignment?.priceOverride === undefined
    ? ''
    : String(assignment.priceOverride);
  const durationText = assignment?.durationOverrideMinutes === null || assignment?.durationOverrideMinutes === undefined
    ? ''
    : String(assignment.durationOverrideMinutes);
  return {
    specialistId,
    specialistName,
    canEdit,
    enabled,
    editing: false,
    priceText,
    durationText,
    original: assignment,
  };
}

function parseOptional(text: string) {
  return text.trim() === '' ? null : Number(text);
}

function isPriceInvalid(text: string) {
  const value = parseOptional(text);
  return value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_PRICE);
}

function isDurationInvalid(text: string) {
  const value = parseOptional(text);
  return value !== null && (!Number.isInteger(value) || value < MIN_DURATION || value > MAX_DURATION);
}

export function hasInvalidAssignmentDrafts(drafts: AssignmentDraft[]) {
  return drafts.some((draft) => isPriceInvalid(draft.priceText) || isDurationInvalid(draft.durationText));
}

export function toAssignmentPayload(draft: AssignmentDraft): AssignmentPayload {
  return {
    isActive: draft.enabled,
    priceOverride: parseOptional(draft.priceText),
    durationOverrideMinutes: parseOptional(draft.durationText),
  };
}

/**
 * Returns drafts that need an assignment update. With `includeAvailability: false` only enabled
 * drafts with changed overrides are returned, because the service save already applies availability.
 */
export function getChangedAssignmentDrafts(drafts: AssignmentDraft[], { includeAvailability = true } = {}) {
  return drafts.filter((draft) => {
    const payload = toAssignmentPayload(draft);
    const original = draft.original;
    const overridesChanged = payload.priceOverride !== (original?.priceOverride ?? null)
      || payload.durationOverrideMinutes !== (original?.durationOverrideMinutes ?? null);
    if (!includeAvailability) {
      return draft.enabled && overridesChanged;
    }
    return overridesChanged || payload.isActive !== (original?.isActive ?? false);
  });
}

type Props = {
  drafts: AssignmentDraft[];
  basePrice: number;
  baseDurationMinutes: number;
  disabled?: boolean;
  onChange: (drafts: AssignmentDraft[]) => void;
};

export function ServiceAssignmentsEditor({
  drafts,
  basePrice,
  baseDurationMinutes,
  disabled = false,
  onChange,
}: Props) {
  const { t, locale } = useI18n();
  const update = (specialistId: number, patch: Partial<AssignmentDraft>) => {
    onChange(drafts.map((draft) => draft.specialistId === specialistId ? { ...draft, ...patch } : draft));
  };

  return (
    <Stack className="service-assignments">
      {drafts.map((draft) => {
        const price = parseOptional(draft.priceText);
        const duration = parseOptional(draft.durationText);
        const isCustom = price !== null || duration !== null;
        const priceInvalid = isPriceInvalid(draft.priceText);
        const durationInvalid = isDurationInvalid(draft.durationText);
        const effectivePrice = priceInvalid || price === null ? basePrice : price;
        const effectiveDuration = durationInvalid || duration === null ? baseDurationMinutes : duration;
        const canEdit = draft.canEdit && !disabled;

        return (
          <Box
            key={draft.specialistId}
            className={['service-assignments__row', draft.enabled ? '' : 'service-assignments__row--off'].filter(Boolean).join(' ')}
          >
            <Checkbox
              checked={draft.enabled}
              disabled={!canEdit}
              onChange={(event) => update(draft.specialistId, { enabled: event.target.checked })}
              slotProps={{ input: { 'aria-label': draft.specialistName } }}
            />
            <Stack direction="row" className="service-assignments__identity">
              <AppAvatar name={draft.specialistName} />
              <Typography className="service-assignments__name">{draft.specialistName}</Typography>
            </Stack>

            {draft.editing ? (
              <Box className="service-assignments__fields">
                <AppTextField
                  size="small"
                  type="number"
                  label={t('services.price')}
                  value={draft.priceText}
                  placeholder={String(basePrice)}
                  disabled={!canEdit}
                  error={priceInvalid}
                  helperText={priceInvalid ? t('services.priceError') : (price === null ? t('services.serviceDefault') : undefined)}
                  slotProps={{ htmlInput: { min: 0, max: MAX_PRICE, step: 1 }, inputLabel: { shrink: true } }}
                  onChange={(event) => update(draft.specialistId, { priceText: event.target.value })}
                />
                <AppTextField
                  size="small"
                  type="number"
                  label={t('services.duration')}
                  value={draft.durationText}
                  placeholder={String(baseDurationMinutes)}
                  disabled={!canEdit}
                  error={durationInvalid}
                  helperText={durationInvalid ? t('services.durationError') : (duration === null ? t('services.serviceDefault') : undefined)}
                  slotProps={{ htmlInput: { min: MIN_DURATION, max: MAX_DURATION, step: 1 }, inputLabel: { shrink: true } }}
                  onChange={(event) => update(draft.specialistId, { durationText: event.target.value })}
                />
              </Box>
            ) : (
              <Stack direction="row" className="service-assignments__summary">
                {isCustom ? <AppStatusBadge label={t('services.customBadge')} tone="warning" /> : null}
                <Typography
                  component="span"
                  className={isCustom ? 'service-assignments__value' : 'service-assignments__value service-assignments__value--inherited'}
                >
                  {formatMoney(effectivePrice, 'RUB', locale)} · {formatServiceDuration(effectiveDuration, t)}
                </Typography>
                {canEdit ? (
                  <AppButton
                    size="small"
                    variant="text"
                    onClick={() => update(draft.specialistId, { editing: true })}
                  >
                    {isCustom ? t('services.edit') : t('services.setCustom')}
                  </AppButton>
                ) : null}
              </Stack>
            )}

            {canEdit && (isCustom || draft.editing) ? (
              <Tooltip title={t('services.useServiceDefaults')}>
                <IconButton
                  size="small"
                  aria-label={`${t('services.useServiceDefaults')}: ${draft.specialistName}`}
                  className="service-assignments__reset"
                  onClick={() => update(draft.specialistId, { priceText: '', durationText: '', editing: false })}
                >
                  <RestartAltRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : <Box className="service-assignments__reset" />}
          </Box>
        );
      })}
    </Stack>
  );
}
