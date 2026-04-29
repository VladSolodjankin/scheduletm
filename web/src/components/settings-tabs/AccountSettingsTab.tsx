import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

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
