import { Box, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { Controller, Control, useWatch } from 'react-hook-form';
import { useEffect, useState } from 'react';

import type { AccountSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import { TimezoneSelect } from '../TimezoneSelect';

type Props = {
  copy: SettingsCardCopy;
  control: Control<AccountSettings>;
  meetingDurationOptions: number[];
  isSaving: boolean;
  onSubmit: () => void;
};

export function AccountSettingsTab({ copy, control, meetingDurationOptions, isSaving, onSubmit }: Props) {
  const businessAddress = useWatch({ control, name: 'businessAddress' }) ?? '';
  const businessLat = useWatch({ control, name: 'businessLat' });
  const businessLng = useWatch({ control, name: 'businessLng' });
  const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
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
  const hasCoordinates = typeof mapLat === 'number' && typeof mapLng === 'number';
  const staticMapUrl = hasCoordinates && mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+285A98(${mapLng},${mapLat})/${mapLng},${mapLat},14/720x320?access_token=${mapboxToken}`
    : '';

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

      <Controller
        name="businessLat"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField
            field={field}
            label={copy.businessLat}
            type="number"
            parseValue={(value) => (value.trim() === '' ? null : Number(value))}
          />
        )}
      />

      <Controller
        name="businessLng"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField
            field={field}
            label={copy.businessLng}
            type="number"
            parseValue={(value) => (value.trim() === '' ? null : Number(value))}
          />
        )}
      />

      <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {copy.businessMapPreview}
        </Typography>
        {mapboxToken && staticMapUrl ? (
          <Box component="img" src={staticMapUrl} alt={copy.businessAddress} sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            {copy.mapboxTokenMissingHint}
          </Typography>
        )}
        {businessAddress.trim() ? (
          <AppButton
            variant="outlined"
            onClick={() => window.open(`https://www.mapbox.com/search/?query=${encodeURIComponent(businessAddress.trim())}`, '_blank', 'noopener,noreferrer')}
          >
            {copy.openMapboxSearch}
          </AppButton>
        ) : null}
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
