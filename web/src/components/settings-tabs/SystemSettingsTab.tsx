import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

import type { SystemSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';

type Props = {
  copy: SettingsCardCopy;
  control: Control<SystemSettings>;
  meetingDurationOptions: number[];
  isSaving: boolean;
  onSubmit: () => void;
};

export function SystemSettingsTab({ copy, control, meetingDurationOptions, isSaving, onSubmit }: Props) {
  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.systemTitle}</Typography>

      <Controller
        name="defaultMeetingDuration"
        control={control}
        render={({ field }: any) => (
          <FormControl fullWidth margin="normal">
            <InputLabel id="system-default-meeting-duration-label">{copy.defaultMeetingDuration}</InputLabel>
            <Select
              labelId="system-default-meeting-duration-label"
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
        name="refreshTokenTtlDays"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField
            field={field}
            label={copy.refreshTokenTtlDays}
            type="number"
            slotProps={{ htmlInput: { min: 1, max: 365 } }}
            parseValue={(value) => Number(value)}
          />
        )}
      />

      <Controller
        name="accessTokenTtlSeconds"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField
            field={field}
            label={copy.accessTokenTtlSeconds}
            type="number"
            slotProps={{ htmlInput: { min: 60, max: 86400 } }}
            parseValue={(value) => Number(value)}
          />
        )}
      />

      <Controller
        name="sessionCookieName"
        control={control}
        render={({ field }: any) => <AppRhfTextField field={field} label={copy.sessionCookieName} />}
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
