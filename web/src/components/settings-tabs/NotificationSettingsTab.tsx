import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

import type { NotificationChannel } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';

type NotificationDefaultsForm = {
  channels: NotificationChannel[];
  appointmentReminderTimings: string[];
  paymentReminderTimings: string[];
};

type Props = {
  copy: SettingsCardCopy;
  control: Control<NotificationDefaultsForm>;
  timingOptions: string[];
  selectableChannels: NotificationChannel[];
  isSaving: boolean;
  onSubmit: () => void;
};

export function NotificationSettingsTab({ copy, control, timingOptions, selectableChannels, isSaving, onSubmit }: Props) {
  const onChangeTiming = (field: any, event: SelectChangeEvent<unknown>) => {
    const value = event.target.value as string[];

    if (field.value.includes('disabled') && value.length > 1) {
      field.onChange(value.filter((v) => v !== 'disabled'));
      return;
    }

    if (value.includes('disabled')) {
      field.onChange(['disabled']);
      return;
    }

    field.onChange(value);
  };

  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.notificationSettingsTitle}</Typography>

      <Controller
        name="channels"
        control={control}
        render={({ field }: any) => (
          <FormControl>
            <InputLabel id="notification-channels-label">{copy.reminderChannelsLabel}</InputLabel>
            <Select
              {...field}
              labelId="notification-channels-label"
              label={copy.reminderChannelsLabel}
              multiple
              value={field.value}
              onChange={(event) => field.onChange(event.target.value as NotificationChannel[])}
              renderValue={(selected) => (selected as NotificationChannel[]).map((item) => copy.channels[item]).join(', ')}
            >
              {selectableChannels.map((channel) => (
                <MenuItem key={channel} value={channel}>
                  <Checkbox checked={(field.value as NotificationChannel[]).includes(channel)} />
                  <ListItemText primary={copy.channels[channel]} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      <Controller
        name="appointmentReminderTimings"
        control={control}
        render={({ field }: any) => (
          <FormControl>
            <InputLabel id="appointment-reminder-timings-label">{copy.appointmentReminderTimingsLabel}</InputLabel>
            <Select
              {...field}
              labelId="appointment-reminder-timings-label"
              label={copy.appointmentReminderTimingsLabel}
              multiple
              value={field.value}
              onChange={(event) => onChangeTiming(field, event as SelectChangeEvent<unknown>)}
              renderValue={(selected) => (selected as string[]).map((item) => item === 'disabled' ? copy.disabledOption : item).join(', ')}
            >
              {timingOptions.map((timing) => (
                <MenuItem key={timing} value={timing}>
                  <Checkbox checked={(field.value as string[]).includes(timing)} />
                  <ListItemText primary={timing === 'disabled' ? copy.disabledOption : timing} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      <Controller
        name="paymentReminderTimings"
        control={control}
        render={({ field }: any) => (
          <FormControl>
            <InputLabel id="payment-reminder-timings-label">{copy.paymentReminderTimingsLabel}</InputLabel>
            <Select
              {...field}
              labelId="payment-reminder-timings-label"
              label={copy.paymentReminderTimingsLabel}
              multiple
              value={field.value}
              onChange={(event) => onChangeTiming(field, event as SelectChangeEvent<unknown>)}
              renderValue={(selected) => (selected as string[]).map((item) => item === 'disabled' ? copy.disabledOption : item).join(', ')}
            >
              {timingOptions.map((timing) => (
                <MenuItem key={timing} value={timing}>
                  <Checkbox checked={(field.value as string[]).includes(timing)} />
                  <ListItemText primary={timing === 'disabled' ? copy.disabledOption : timing} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSaving}>
        {copy.saveSettings}
      </AppButton>
    </AppForm>
  );
}
