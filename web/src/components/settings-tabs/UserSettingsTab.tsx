import { Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

import type { UserSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppRhfPhoneField } from '../../shared/ui/AppRhfPhoneField';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import { TimezoneSelect } from '../TimezoneSelect';

type Props = {
  copy: SettingsCardCopy;
  control: Control<UserSettings>;
  isSaving: boolean;
  onSubmit: () => void;
};

export function UserSettingsTab({
  copy,
  control,
  isSaving,
  onSubmit,
}: Props) {
  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.userTitle}</Typography>

      <Controller
        name="timezone"
        control={control}
        render={({ field }: any) => (
          <TimezoneSelect
            label={copy.timezone}
            labelId="user-timezone-label"
            value={field.value}
            onChange={field.onChange}
            margin="normal"
          />
        )}
      />

      <Controller
        name="locale"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField field={field} label={copy.locale} />
        )}
      />

      <Controller
        name="firstName"
        control={control}
        rules={{ required: copy.firstName }}
        render={({ field, fieldState }: any) => (
          <AppRhfTextField field={field} label={copy.firstName} required error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />
        )}
      />

      <Controller
        name="lastName"
        control={control}
        rules={{ required: copy.lastName }}
        render={({ field, fieldState }: any) => (
          <AppRhfTextField field={field} label={copy.lastName} required error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />
        )}
      />

      <Controller
        name="phone"
        control={control}
        render={({ field }: any) => (
          <AppRhfPhoneField field={field} label={copy.phone} sx={{ mt: 1 }} />
        )}
      />

      <Controller
        name="telegramUsername"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField field={field} label={copy.telegram} autoComplete="off" />
        )}
      />

      <AppButton type="submit" isLoading={isSaving}>
        {copy.saveSettings}
      </AppButton>
    </AppForm>
  );
}
