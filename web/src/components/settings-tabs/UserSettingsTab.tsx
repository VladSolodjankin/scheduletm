import { Stack, Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

import type { UserSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfPasswordField } from '../../shared/ui/AppRhfPasswordField';
import { AppRhfPhoneField } from '../../shared/ui/AppRhfPhoneField';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import { TimezoneSelect } from '../TimezoneSelect';

type Props = {
  copy: SettingsCardCopy;
  control: Control<UserSettings>;
  userSettings: UserSettings;
  isSaving: boolean;
  isGoogleConnecting: boolean;
  isGoogleDisconnecting: boolean;
  onSubmit: () => void;
  onClearTelegramBotToken: () => Promise<void> | void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
};

export function UserSettingsTab({
  copy,
  control,
  userSettings,
  isSaving,
  isGoogleConnecting,
  isGoogleDisconnecting,
  onSubmit,
  onClearTelegramBotToken,
  onConnectGoogle,
  onDisconnectGoogle,
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
          <AppRhfTextField field={field} label={copy.telegram} />
        )}
      />

      <Controller
        name="telegramBotToken"
        control={control}
        render={({ field }: any) => (
          <AppRhfPasswordField field={field} label={copy.telegramBotToken} />
        )}
      />

      <Typography variant="body2" color="text.secondary">
        {userSettings.telegramBotConnected
          ? `${copy.telegramBotConnected}: ${userSettings.telegramBotName ?? '@unknown'}${userSettings.telegramBotUsername ? ` (@${userSettings.telegramBotUsername})` : ''}`
          : copy.telegramBotNotConnected}
      </Typography>

      <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSaving}>
        {copy.saveSettings}
      </AppButton>

      {userSettings.telegramBotConnected && (
        <AppButton
          type="button"
          variant="outlined"
          color="error"
          onClick={onClearTelegramBotToken}
          disabled={isSaving}
        >
          {copy.clearTelegramBotToken}
        </AppButton>
      )}

      <Typography variant="h5">{copy.integrationsTitle}</Typography>
      <Typography color="text.secondary" variant="body2">
        {copy.integrationsSubtitle}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <AppButton
          variant="outlined"
          onClick={onConnectGoogle}
          disabled={userSettings.googleConnected || isGoogleDisconnecting}
          isLoading={isGoogleConnecting}
        >
          {isGoogleConnecting ? copy.connectingGoogle : copy.connectGoogle}
        </AppButton>

        {userSettings.googleConnected && (
          <AppButton
            variant="outlined"
            color="error"
            onClick={onDisconnectGoogle}
            isLoading={isGoogleDisconnecting}
            disabled={isGoogleConnecting}
          >
            {isGoogleDisconnecting ? copy.disconnectingGoogle : copy.disconnectGoogle}
          </AppButton>
        )}
      </Stack>
    </AppForm>
  );
}
