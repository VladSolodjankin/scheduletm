import { IconButton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Control, Controller } from 'react-hook-form';

import type { UserSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfSecretKeyField } from '../../shared/ui/AppRhfSecretKeyField';

type Props = {
  copy: SettingsCardCopy;
  control: Control<UserSettings>;
  userSettings: UserSettings;
  isSaving: boolean;
  isGoogleConnecting: boolean;
  isGoogleDisconnecting: boolean;
  isZoomConnecting: boolean;
  onSubmit: () => void;
  onClearTelegramBotToken: () => Promise<void> | void;
  onConnectGoogle: () => void;
  onConnectZoom: () => void;
  onDisconnectGoogle: () => void;
};

function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M9 7.364v3.491h4.851c-.213 1.123-.852 2.075-1.811 2.716l2.931 2.273c1.707-1.573 2.691-3.886 2.691-6.64 0-.639-.057-1.253-.164-1.84H9z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.805 5.957-2.18l-2.931-2.273c-.805.54-1.84.86-3.026.86-2.33 0-4.305-1.575-5.01-3.695H.959v2.344A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#4A90E2"
        d="M3.99 10.712A5.406 5.406 0 0 1 3.71 9c0-.591.1-1.164.28-1.712V4.944H.959A8.997 8.997 0 0 0 0 9c0 1.449.344 2.82.959 4.056l3.031-2.344z"
      />
      <path
        fill="#FBBC05"
        d="M9 3.593c1.32 0 2.504.455 3.434 1.348L15.021 2.4C13.462.95 11.424 0 9 0A8.997 8.997 0 0 0 .959 4.944L3.99 7.288C4.695 5.168 6.67 3.593 9 3.593z"
      />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#2D8CFF"
        d="M7.5 6.75h5.4c2.1 0 3.15 0 3.9.41.66.36 1.19.89 1.55 1.55.41.75.41 1.8.41 3.9v.78c0 2.1 0 3.15-.41 3.9a3.75 3.75 0 0 1-1.55 1.55c-.75.41-1.8.41-3.9.41H7.5c-2.1 0-3.15 0-3.9-.41a3.75 3.75 0 0 1-1.55-1.55c-.41-.75-.41-1.8-.41-3.9v-.78c0-2.1 0-3.15.41-3.9A3.75 3.75 0 0 1 3.6 7.16c.75-.41 1.8-.41 3.9-.41Zm12.08 2.85 2.92-1.83c.57-.36 1.3.05 1.3.72v7.02c0 .67-.73 1.08-1.3.72l-2.92-1.83V9.6Z"
      />
    </svg>
  );
}

export function IntegrationsSettingsTab({
  copy,
  control,
  userSettings,
  isSaving,
  isGoogleConnecting,
  isGoogleDisconnecting,
  isZoomConnecting,
  onSubmit,
  onClearTelegramBotToken,
  onConnectGoogle,
  onConnectZoom,
  onDisconnectGoogle,
}: Props) {
  const [isEditingTelegramToken, setIsEditingTelegramToken] = useState(false);
  const shouldShowTelegramTokenField = !userSettings.telegramBotConnected || isEditingTelegramToken;

  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.integrationsTitle}</Typography>
      <Typography color="text.secondary" variant="body2">
        {copy.integrationsSubtitle}
      </Typography>

      {shouldShowTelegramTokenField && (
        <Controller
          name="telegramBotToken"
          control={control}
          render={({ field }: any) => (
            <AppRhfSecretKeyField field={field} label={copy.telegramBotToken} autoComplete="off" />
          )}
        />
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {userSettings.telegramBotConnected
            ? `${copy.telegramBotConnected}: ${userSettings.telegramBotName ?? '@unknown'}${userSettings.telegramBotUsername ? ` (@${userSettings.telegramBotUsername})` : ''}`
            : copy.telegramBotNotConnected}
        </Typography>
        {userSettings.telegramBotConnected && !isEditingTelegramToken && (
          <IconButton
            size="small"
            aria-label={copy.editTelegramBotToken}
            onClick={() => setIsEditingTelegramToken(true)}
          >
            <AppIcons.edit fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <AppButton
          variant="outlined"
          onClick={onConnectZoom}
          isLoading={isZoomConnecting}
          disabled={userSettings.zoomConnected || isGoogleConnecting || isGoogleDisconnecting}
          startIcon={!isZoomConnecting ? <ZoomIcon /> : undefined}
          sx={{
            textTransform: 'none',
            borderColor: '#2D8CFF',
            color: '#2D8CFF',
            backgroundColor: '#FFFFFF',
            '&:hover': {
              borderColor: '#2274D9',
              backgroundColor: '#F4F9FF',
            },
          }}
        >
          {isZoomConnecting
            ? copy.connectingZoom
            : (userSettings.zoomConnected ? copy.zoomConnected : copy.connectZoom)}
        </AppButton>

        <AppButton
          variant="outlined"
          onClick={onConnectGoogle}
          disabled={userSettings.googleConnected || isGoogleDisconnecting}
          isLoading={isGoogleConnecting}
          startIcon={!isGoogleConnecting ? <GoogleGIcon /> : undefined}
          sx={{
            textTransform: 'none',
            borderColor: '#DADCE0',
            color: '#3C4043',
            backgroundColor: '#FFFFFF',
            '&:hover': {
              borderColor: '#DADCE0',
              backgroundColor: '#F8F9FA',
            },
          }}
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
