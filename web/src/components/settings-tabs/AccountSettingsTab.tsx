import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { Controller, Control, useController } from 'react-hook-form';
import { useEffect, useState } from 'react';

import type { AccountSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppConfirmDialog } from '../../shared/ui/AppDialog';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import { BusinessLocationMap } from './BusinessLocationMap';
import { useI18n } from '../../shared/i18n/I18nContext';
import { formatDateTime } from '../../shared/utils/dateTime';
import type { TranslationKey } from '../../shared/i18n/dictionaries';

/** Short weekday names in ISO order (index + 1 is the ISO weekday), shared with the public page schedule. */
const WEEKDAY_LABELS = [
  'publicPageBuilder.monday',
  'publicPageBuilder.tuesday',
  'publicPageBuilder.wednesday',
  'publicPageBuilder.thursday',
  'publicPageBuilder.friday',
  'publicPageBuilder.saturday',
  'publicPageBuilder.sunday',
] as const satisfies readonly TranslationKey[];

type Props = {
  copy: SettingsCardCopy;
  control: Control<AccountSettings>;
  meetingDurationOptions: number[];
  isSaving: boolean;
  onSubmit: () => void;
  onRequestAccountDeletion: () => Promise<void> | void;
  onCancelAccountDeletion: () => Promise<void> | void;
};

export function AccountSettingsTab({ copy, control, meetingDurationOptions, isSaving, onSubmit, onRequestAccountDeletion, onCancelAccountDeletion }: Props) {
  const { locale, t } = useI18n();
  const { field: businessAddressField } = useController({ control, name: 'businessAddress' });
  const { field: businessLatField } = useController({ control, name: 'businessLat' });
  const { field: businessLngField } = useController({ control, name: 'businessLng' });
  const businessLat = businessLatField.value;
  const businessLng = businessLngField.value;
  const [defaultCoordinates, setDefaultCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { field: deleteScheduledAtField } = useController({ control, name: 'deleteScheduledAt' });

  useEffect(() => {
    if (typeof businessLat === 'number' && typeof businessLng === 'number') {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      setDefaultCoordinates({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    });
  }, [businessLat, businessLng]);

  const mapLat = typeof businessLat === 'number' ? businessLat : defaultCoordinates?.lat;
  const mapLng = typeof businessLng === 'number' ? businessLng : defaultCoordinates?.lng;

  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.accountTitle}</Typography>

      <Controller name="businessAddress" control={control} render={({ field }: any) => (
        <AppRhfTextField field={field} label={copy.businessAddress} />
      )} />

      <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
        <BusinessLocationMap
          initialCoordinates={typeof mapLat === 'number' && typeof mapLng === 'number' ? { lat: mapLat, lng: mapLng } : null}
          hintLabel={copy.businessMapPreview}
          saveLabel={copy.selectAddress}
          onSave={({ lat, lng, fullAddress }) => {
            businessLatField.onChange(lat);
            businessLngField.onChange(lng);
            if (fullAddress) {
              businessAddressField.onChange(fullAddress);
            }
          }}
          tokenMissingLabel={copy.mapboxTokenMissingHint}
        />
      </Stack>

      <Controller
        name="defaultMeetingDuration"
        control={control}
        render={({ field }: any) => (
          <FormControl fullWidth margin="normal">
            <InputLabel id="account-default-meeting-duration-label">{copy.defaultMeetingDuration}</InputLabel>
            <Select
              labelId="account-default-meeting-duration-label"
              value={String(field.value)}
              label={copy.defaultMeetingDuration}
              onChange={(event) => field.onChange(Number(event.target.value))}
            >
              {meetingDurationOptions.map((duration) => (
                <MenuItem key={duration} value={String(duration)}>{duration}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      <Controller
        name="dailyDigestEnabled"
        control={control}
        render={({ field }: any) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            label={copy.dailyDigestEnabled}
          />
        )}
      />

      <Controller
        name="weekStartsOnMonday"
        control={control}
        render={({ field }: any) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            label={copy.weekStartsOnMonday}
          />
        )}
      />

      <Controller
        name="workDays"
        control={control}
        rules={{ validate: (value) => (value?.length ?? 0) > 0 || t('settings.workDaysRequired') }}
        render={({ field, fieldState }) => {
          const selected = field.value ?? [];
          const toggle = (day: number, checked: boolean) => {
            const next = checked ? [...selected.filter((item) => item !== day), day] : selected.filter((item) => item !== day);
            field.onChange(next.sort((a, b) => a - b));
          };
          return (
            <FormControl component="fieldset" error={Boolean(fieldState.error)} margin="normal" sx={{ display: 'block' }}>
              <FormLabel component="legend">{t('settings.workDays')}</FormLabel>
              <FormGroup row>
                {WEEKDAY_LABELS.map((labelKey, index) => (
                  <FormControlLabel
                    key={labelKey}
                    label={t(labelKey)}
                    control={<Checkbox checked={selected.includes(index + 1)} onChange={(event) => toggle(index + 1, event.target.checked)} />}
                  />
                ))}
              </FormGroup>
              {fieldState.error?.message ? <FormHelperText>{fieldState.error.message}</FormHelperText> : null}
            </FormControl>
          );
        }}
      />

      <Controller
        name="specialistsSeeAllAppointments"
        control={control}
        render={({ field }: any) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            label={copy.specialistsSeeAllAppointments}
          />
        )}
      />

      <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSaving}>
        {copy.saveSettings}
      </AppButton>
      <Stack spacing={1} sx={{ mt: 4 }}>
        {deleteScheduledAtField.value && <Typography variant="body2">{copy.accountDeleteScheduledAt.replace('{date}', formatDateTime(deleteScheduledAtField.value, locale))}</Typography>}
        <AppButton color={deleteScheduledAtField.value ? 'inherit' : 'error'} type="button" onClick={() => {
          if (deleteScheduledAtField.value) {
            void onCancelAccountDeletion();
            return;
          }
          setIsDeleteConfirmOpen(true);
        }}>
          {deleteScheduledAtField.value ? copy.accountCancelDeleteButton : copy.accountDeleteButton}
        </AppButton>
      </Stack>

      <AppConfirmDialog
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        maxWidth="xs"
        title={copy.accountDeleteConfirmTitle}
        description={copy.accountDeleteConfirmDescription}
        cancelLabel={copy.cancel}
        confirmLabel={copy.accountDeleteButton}
        confirmColor="error"
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          void onRequestAccountDeletion();
          setIsDeleteConfirmOpen(false);
        }}
      />
    </AppForm>
  );
}
