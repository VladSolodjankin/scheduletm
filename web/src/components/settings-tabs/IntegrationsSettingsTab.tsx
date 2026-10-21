import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, IconButton, Popover, Stack, Typography } from '@mui/material';
import { MouseEvent, useState } from 'react';

import type { UserSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { rem } from '../../shared/theme/constants';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppStatusBadge } from '../../shared/ui/AppStatus';

type Props = {
  copy: SettingsCardCopy;
  userSettings: UserSettings;
  isGoogleConnecting: boolean;
  isGoogleDisconnecting: boolean;
  isZoomConnecting: boolean;
  isYandexConnecting: boolean;
  isYandexDisconnecting: boolean;
  onConnectGoogle: () => void;
  onConnectZoom: () => void;
  onConnectYandex: () => void;
  onDisconnectYandex: () => void;
  onDisconnectGoogle: () => void;
};

type IntegrationPanelProps = {
  accentColor: string;
  icon: React.ReactNode;
  statusLabel: string;
  isConnected: boolean;
  title: string;
  description: string;
  actions: React.ReactNode;
};

function IntegrationPanel({ accentColor, icon, statusLabel, isConnected, title, description, actions }: IntegrationPanelProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3,
        borderColor: alpha(accentColor, 0.18),
        background: `linear-gradient(180deg, ${alpha(accentColor, 0.09)} 0%, ${alpha(accentColor, 0.03)} 28%, #FFFFFF 100%)`,
        boxShadow: `0 ${rem(12)} ${rem(30)} ${alpha(accentColor, 0.08)}`,
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
                    border: `${rem(1)} solid ${alpha(accentColor, 0.18)}`,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {title}
                </Typography>
              </Stack>

              <AppStatusBadge
                label={statusLabel}
                tone={isConnected ? 'success' : 'neutral'}
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

function YandexIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="#FC3F1D" />
      <path
        fill="#FFFFFF"
        d="M13.3 18.5h1.9V5.5h-2.7c-2.6 0-4 1.4-4 3.4 0 1.6.8 2.6 2.1 3.5l-2.4 6.1h2.1l2.2-5.7-.7-.5c-1-.7-1.5-1.3-1.5-2.4 0-1.1.7-1.9 2.1-1.9h.9v10.5Z"
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
  userSettings,
  isGoogleConnecting,
  isGoogleDisconnecting,
  isZoomConnecting,
  isYandexConnecting,
  isYandexDisconnecting,
  onConnectGoogle,
  onConnectZoom,
  onConnectYandex,
  onDisconnectYandex,
  onDisconnectGoogle,
}: Props) {
  const [helpAnchorEl, setHelpAnchorEl] = useState<HTMLElement | null>(null);
  const [openHelpKey, setOpenHelpKey] = useState<'zoom' | 'yandex' | 'google' | null>(null);

  const handleOpenHelp = (event: MouseEvent<HTMLElement>, key: 'zoom' | 'yandex' | 'google') => {
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
      : openHelpKey === 'yandex'
        ? { title: copy.connectYandexHelpTitle, description: copy.connectYandexHelpDescription }
      : openHelpKey === 'google'
        ? { title: copy.connectGoogleHelpTitle, description: copy.connectGoogleHelpDescription }
        : null;

  return (
    <AppForm>
      <Typography variant="h5">{copy.integrationsTitle}</Typography>
      <Typography color="text.secondary" variant="body2">
        {copy.integrationsSubtitle}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: `repeat(auto-fit, minmax(${rem(280)}, 1fr))`,
          alignItems: 'stretch',
        }}
      >
        <IntegrationPanel
          accentColor="#2D8CFF"
          icon={<ZoomIcon />}
          statusLabel={userSettings.zoomConnected ? 'Connected' : 'Available'}
          isConnected={userSettings.zoomConnected}
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
                    boxShadow: `0 ${rem(8)} ${rem(18)} ${alpha('#2D8CFF', 0.12)}`,
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
          accentColor="#FC3F1D"
          icon={<YandexIcon />}
          statusLabel={userSettings.yandexConnected ? 'Connected' : 'Available'}
          isConnected={userSettings.yandexConnected}
          title={copy.connectYandexHelpTitle}
          description={copy.connectYandexHelpDescription}
          actions={(
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <AppButton
                  variant="outlined"
                  onClick={onConnectYandex}
                  isLoading={isYandexConnecting}
                  disabled={userSettings.yandexConnected || isYandexDisconnecting}
                  startIcon={!isYandexConnecting ? <YandexIcon /> : undefined}
                  sx={{
                    minWidth: 164,
                    textTransform: 'none',
                    borderColor: '#FC3F1D',
                    color: '#FC3F1D',
                    backgroundColor: '#FFFFFF',
                    boxShadow: `0 ${rem(8)} ${rem(18)} ${alpha('#FC3F1D', 0.12)}`,
                    '&:hover': {
                      borderColor: '#D8310F',
                      backgroundColor: '#FFF5F3',
                    },
                  }}
                >
                  {isYandexConnecting
                    ? copy.connectingYandex
                    : (userSettings.yandexConnected ? copy.yandexConnected : copy.connectYandex)}
                </AppButton>
                <IconButton size="small" aria-label={copy.connectYandexHelpTitle} onClick={(event) => handleOpenHelp(event, 'yandex')}>
                  <AppIcons.info fontSize="small" />
                </IconButton>
              </Stack>

              {userSettings.yandexConnected && (
                <AppButton
                  variant="outlined"
                  color="error"
                  onClick={onDisconnectYandex}
                  isLoading={isYandexDisconnecting}
                  disabled={isYandexConnecting}
                  sx={{ alignSelf: 'flex-start', minWidth: 164, backgroundColor: '#FFFFFF' }}
                >
                  {isYandexDisconnecting ? copy.disconnectingYandex : copy.disconnectYandex}
                </AppButton>
              )}
            </Stack>
          )}
        />

        <IntegrationPanel
          accentColor="#DB4437"
          icon={<GoogleGIcon />}
          statusLabel={userSettings.googleConnected ? 'Connected' : 'Available'}
          isConnected={userSettings.googleConnected}
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
                    boxShadow: `0 ${rem(8)} ${rem(18)} ${alpha('#DB4437', 0.08)}`,
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

              <Typography variant="caption" color="text.secondary">
                {copy.googleCalendarCaption}
              </Typography>
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
