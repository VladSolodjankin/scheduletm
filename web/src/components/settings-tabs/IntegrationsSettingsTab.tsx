import { Stack, Typography } from '@mui/material';
import { Control, Controller } from 'react-hook-form';

import type { UserSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppRhfSecretKeyField } from '../../shared/ui/AppRhfSecretKeyField';

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

export function IntegrationsSettingsTab({
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
      <Typography variant="h5">{copy.integrationsTitle}</Typography>
      <Typography color="text.secondary" variant="body2">
        {copy.integrationsSubtitle}
      </Typography>

      <Controller
        name="telegramBotToken"
        control={control}
        render={({ field }: any) => (
          <AppRhfSecretKeyField field={field} label={copy.telegramBotToken} autoComplete="off" />
        )}
      />

      <Typography variant="body2" color="text.secondary">
        {userSettings.telegramBotConnected
          ? `${copy.telegramBotConnected}: ${userSettings.telegramBotName ?? '@unknown'}${userSettings.telegramBotUsername ? ` (@${userSettings.telegramBotUsername})` : ''}`
          : copy.telegramBotNotConnected}
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

      <AppButton type="submit" isLoading={isSaving}>
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
    </AppForm>
  );
}
