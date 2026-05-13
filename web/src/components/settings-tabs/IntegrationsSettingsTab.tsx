import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, Chip, IconButton, Popover, Stack, Typography } from '@mui/material';
import { MouseEvent, useState } from 'react';
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

type IntegrationPanelProps = {
  accentColor: string;
  icon: React.ReactNode;
  statusLabel: string;
  title: string;
  description: string;
  actions: React.ReactNode;
};

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M21.4 4.6a1.1 1.1 0 0 0-1.12-.18L3.83 10.9a1.08 1.08 0 0 0 .1 2.05l4.21 1.32 1.62 5.04a1.08 1.08 0 0 0 1.96.2l2.27-3.08 4.46 3.26a1.08 1.08 0 0 0 1.7-.65l2.32-13.38a1.1 1.1 0 0 0-.37-1.06Zm-10.2 10.1-.46 3.18-.96-3-3.02-.95 11.35-4.61-6.91 5.38Z"
      />
    </svg>
  );
}

function IntegrationPanel({ accentColor, icon, statusLabel, title, description, actions }: IntegrationPanelProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3,
        borderColor: alpha(accentColor, 0.18),
        background: `linear-gradient(180deg, ${alpha(accentColor, 0.09)} 0%, ${alpha(accentColor, 0.03)} 28%, #FFFFFF 100%)`,
        boxShadow: `0 12px 30px ${alpha(accentColor, 0.08)}`,
      }}
    >
      <CardContent
        sx={{
          height: '100%',
          p: 2.5,
          '&:last-child': { pb: 2.5 },
        }}
      >
        <Stack spacing={2} sx={{ height: '100%', minHeight: 220, justifyContent: 'space-between' }}>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accentColor,
                    backgroundColor: alpha(accentColor, 0.12),
                    border: `1px solid ${alpha(accentColor, 0.18)}`,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {title}
                </Typography>
              </Stack>

              <Chip
                label={statusLabel}
                size="small"
                variant="outlined"
                sx={{
                  color: accentColor,
                  borderColor: alpha(accentColor, 0.24),
                  backgroundColor: alpha(accentColor, 0.08),
                  fontWeight: 600,
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Stack>
          <Box>{actions}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

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
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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
  const [helpAnchorEl, setHelpAnchorEl] = useState<HTMLElement | null>(null);
  const [openHelpKey, setOpenHelpKey] = useState<'zoom' | 'google' | null>(null);
  const shouldShowTelegramTokenField = !userSettings.telegramBotConnected || isEditingTelegramToken;

  const handleOpenHelp = (event: MouseEvent<HTMLElement>, key: 'zoom' | 'google') => {
    setHelpAnchorEl(event.currentTarget);
    setOpenHelpKey(key);
  };

  const handleCloseHelp = () => {
    setHelpAnchorEl(null);
    setOpenHelpKey(null);
  };

  const helpCopy =
    openHelpKey === 'zoom'
      ? { title: copy.connectZoomHelpTitle, description: copy.connectZoomHelpDescription }
      : openHelpKey === 'google'
        ? { title: copy.connectGoogleHelpTitle, description: copy.connectGoogleHelpDescription }
        : null;

  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.integrationsTitle}</Typography>
      <Typography color="text.secondary" variant="body2">
        {copy.integrationsSubtitle}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'stretch',
        }}
      >
        <IntegrationPanel
          accentColor="#229ED9"
          icon={<TelegramIcon />}
          statusLabel={userSettings.telegramBotConnected ? 'Bot connected' : 'Setup needed'}
          title={copy.channels.telegram}
          description={
            userSettings.telegramBotConnected
              ? `${copy.telegramBotConnected}: ${userSettings.telegramBotName ?? '@unknown'}${userSettings.telegramBotUsername ? ` (@${userSettings.telegramBotUsername})` : ''}`
              : copy.telegramBotNotConnected
          }
          actions={(
            <Stack spacing={1.5}>
              {shouldShowTelegramTokenField && (
                <Stack spacing={1.5}>
                  <Controller
                    name="telegramBotToken"
                    control={control}
                    render={({ field }: any) => (
                      <AppRhfSecretKeyField field={field} label={copy.telegramBotToken} autoComplete="off" />
                    )}
                  />
                  <AppButton
                    type="submit"
                    isLoading={isSaving}
                    sx={{
                      alignSelf: 'flex-start',
                      minWidth: 164,
                      boxShadow: `0 10px 22px ${alpha('#229ED9', 0.22)}`,
                    }}
                  >
                    {userSettings.telegramBotConnected ? copy.saveSettings : copy.integrateTelegramBot}
                  </AppButton>
                </Stack>
              )}

              {userSettings.telegramBotConnected && !isEditingTelegramToken && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <AppButton
                    type="button"
                    variant="text"
                    onClick={() => setIsEditingTelegramToken(true)}
                    sx={{ px: 0, color: '#1E6D90' }}
                  >
                    {copy.editTelegramBotToken}
                  </AppButton>
                  <IconButton
                    size="small"
                    aria-label={copy.editTelegramBotToken}
                    onClick={() => setIsEditingTelegramToken(true)}
                    sx={{ color: '#1E6D90' }}
                  >
                    <AppIcons.edit fontSize="small" />
                  </IconButton>
                </Stack>
              )}

              {userSettings.telegramBotConnected && (
                <AppButton
                  type="button"
                  variant="outlined"
                  color="error"
                  onClick={onClearTelegramBotToken}
                  disabled={isSaving}
                  sx={{ alignSelf: 'flex-start', minWidth: 164, backgroundColor: '#FFFFFF' }}
                >
                  {copy.clearTelegramBotToken}
                </AppButton>
              )}
            </Stack>
          )}
        />

        <IntegrationPanel
          accentColor="#2D8CFF"
          icon={<ZoomIcon />}
          statusLabel={userSettings.zoomConnected ? 'Connected' : 'Available'}
          title={copy.connectZoomHelpTitle}
          description={copy.connectZoomHelpDescription}
          actions={(
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <AppButton
                  variant="outlined"
                  onClick={onConnectZoom}
                  isLoading={isZoomConnecting}
                  disabled={userSettings.zoomConnected || isGoogleConnecting || isGoogleDisconnecting}
                  startIcon={!isZoomConnecting ? <ZoomIcon /> : undefined}
                  sx={{
                    minWidth: 164,
                    textTransform: 'none',
                    borderColor: '#2D8CFF',
                    color: '#2D8CFF',
                    backgroundColor: '#FFFFFF',
                    boxShadow: `0 8px 18px ${alpha('#2D8CFF', 0.12)}`,
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
                <IconButton size="small" aria-label={copy.connectZoomHelpTitle} onClick={(event) => handleOpenHelp(event, 'zoom')}>
                  <AppIcons.info fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          )}
        />

        <IntegrationPanel
          accentColor="#DB4437"
          icon={<GoogleGIcon />}
          statusLabel={userSettings.googleConnected ? 'Connected' : 'Available'}
          title={copy.connectGoogleHelpTitle}
          description={copy.connectGoogleHelpDescription}
          actions={(
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <AppButton
                  variant="outlined"
                  onClick={onConnectGoogle}
                  disabled={userSettings.googleConnected || isGoogleDisconnecting}
                  isLoading={isGoogleConnecting}
                  startIcon={!isGoogleConnecting ? <GoogleGIcon /> : undefined}
                  sx={{
                    minWidth: 164,
                    textTransform: 'none',
                    borderColor: '#DADCE0',
                    color: '#3C4043',
                    backgroundColor: '#FFFFFF',
                    boxShadow: `0 8px 18px ${alpha('#DB4437', 0.08)}`,
                    '&:hover': {
                      borderColor: '#DADCE0',
                      backgroundColor: '#F8F9FA',
                    },
                  }}
                >
                  {isGoogleConnecting ? copy.connectingGoogle : copy.connectGoogle}
                </AppButton>
                <IconButton size="small" aria-label={copy.connectGoogleHelpTitle} onClick={(event) => handleOpenHelp(event, 'google')}>
                  <AppIcons.info fontSize="small" />
                </IconButton>
              </Stack>

              {userSettings.googleConnected && (
                <AppButton
                  variant="outlined"
                  color="error"
                  onClick={onDisconnectGoogle}
                  isLoading={isGoogleDisconnecting}
                  disabled={isGoogleConnecting}
                  sx={{ alignSelf: 'flex-start', minWidth: 164, backgroundColor: '#FFFFFF' }}
                >
                  {isGoogleDisconnecting ? copy.disconnectingGoogle : copy.disconnectGoogle}
                </AppButton>
              )}
            </Stack>
          )}
        />
      </Box>

      <Popover
        open={Boolean(helpAnchorEl) && Boolean(helpCopy)}
        anchorEl={helpAnchorEl}
        onClose={handleCloseHelp}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Stack spacing={0.5} sx={{ p: 1.5, maxWidth: 320 }}>
          <Typography variant="subtitle2">{helpCopy?.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {helpCopy?.description}
          </Typography>
        </Stack>
      </Popover>
    </AppForm>
  );
}
