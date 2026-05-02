import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { Controller, Control, useController } from 'react-hook-form';
import { useEffect, useState } from 'react';

import type { AccountSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import { TimezoneSelect } from '../TimezoneSelect';
import { BusinessLocationMap } from './BusinessLocationMap';

type Props = {
  copy: SettingsCardCopy;
  control: Control<AccountSettings>;
  meetingDurationOptions: number[];
  isSaving: boolean;
  onSubmit: () => void;
};

export function AccountSettingsTab({ copy, control, meetingDurationOptions, isSaving, onSubmit }: Props) {
  const { field: businessAddressField } = useController({ control, name: 'businessAddress' });
  const { field: businessLatField } = useController({ control, name: 'businessLat' });
  const { field: businessLngField } = useController({ control, name: 'businessLng' });
  const businessLat = businessLatField.value;
  const businessLng = businessLngField.value;
  const [defaultCoordinates, setDefaultCoordinates] = useState<{ lat: number; lng: number } | null>(null);

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

      <Controller
        name="timezone"
        control={control}
        render={({ field }: any) => (
          <TimezoneSelect
            label={copy.timezone}
            labelId="account-timezone-label"
            value={field.value}
            onChange={field.onChange}
            margin="normal"
          />
        )}
      />

      <Controller name="locale" control={control} render={({ field }: any) => (
        <AppRhfTextField field={field} label={copy.locale} />
      )} />

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

      <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSaving}>
        {copy.saveSettings}
      </AppButton>
    </AppForm>
  );
}
