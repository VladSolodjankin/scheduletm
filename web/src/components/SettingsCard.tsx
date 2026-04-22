import { Box, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { SystemSettings, UserSettings } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';
import { AppTab, AppTabs } from '../shared/ui/AppTabs';

type SettingsCardCopy = {
  systemTab: string;
  userTab: string;
  systemTitle: string;
  userTitle: string;
  timezone: string;
  locale: string;
  defaultMeetingDuration: string;
  dailyDigestEnabled: string;
  weekStartsOnMonday: string;
  saveSettings: string;
  integrationsTitle: string;
  integrationsSubtitle: string;
  connectGoogle: string;
  connectingGoogle: string;
  disconnectGoogle: string;
  disconnectingGoogle: string;
  googleConnected: string;
};

type SettingsCardProps = {
  systemSettings: SystemSettings;
  userSettings: UserSettings;
  copy: SettingsCardCopy;
  canManageSystemSettings: boolean;
  isGoogleConnecting: boolean;
  isGoogleDisconnecting: boolean;
  isSavingSystem?: boolean;
  isSavingUser?: boolean;
  onSaveSystem: (next: SystemSettings) => Promise<void> | void;
  onSaveUser: (next: UserSettings) => Promise<void> | void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
};

export function SettingsCard({
  systemSettings,
  userSettings,
  copy,
  canManageSystemSettings,
  isGoogleConnecting,
  isGoogleDisconnecting,
  isSavingSystem = false,
  isSavingUser = false,
  onSaveSystem,
  onSaveUser,
  onConnectGoogle,
  onDisconnectGoogle
}: SettingsCardProps) {
  const [tab, setTab] = useState(canManageSystemSettings ? 0 : 1);

  const { control: systemControl, handleSubmit: handleSystemSubmit, reset: resetSystem } = useForm<SystemSettings>({
    defaultValues: systemSettings
  });

  const { control: userControl, handleSubmit: handleUserSubmit, reset: resetUser } = useForm<UserSettings>({
    defaultValues: userSettings
  });

  useEffect(() => {
    resetSystem(systemSettings);
  }, [resetSystem, systemSettings]);

  useEffect(() => {
    resetUser(userSettings);
  }, [resetUser, userSettings]);

  return (
    <Box>
      <AppTabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <AppTab label={copy.systemTab} disabled={!canManageSystemSettings} />
        <AppTab label={copy.userTab} />
      </AppTabs>

      {tab === 0 && canManageSystemSettings && (
        <AppForm component="form" onSubmit={handleSystemSubmit(onSaveSystem)}>
          <Typography variant="h5">{copy.systemTitle}</Typography>

          <Controller
            name="timezone"
            control={systemControl}
            render={({ field }: any) => (
              <AppRhfTextField field={field} label={copy.timezone} />
            )}
          />

          <Controller
            name="locale"
            control={systemControl}
            render={({ field }: any) => (
              <AppRhfTextField field={field} label={copy.locale} />
            )}
          />

          <Controller
            name="defaultMeetingDuration"
            control={systemControl}
            render={({ field }: any) => (
              <AppRhfTextField
                field={field}
                label={copy.defaultMeetingDuration}
                type="number"
                slotProps={{ htmlInput: { min: 15, max: 180 } }}
                parseValue={(value) => Number(value)}
              />
            )}
          />

          <Controller
            name="dailyDigestEnabled"
            control={systemControl}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.dailyDigestEnabled}
              />
            )}
          />

          <Controller
            name="weekStartsOnMonday"
            control={systemControl}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.weekStartsOnMonday}
              />
            )}
          />

          <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSavingSystem}>
            {copy.saveSettings}
          </AppButton>
        </AppForm>
      )}

      {tab === 1 && (
        <AppForm component="form" onSubmit={handleUserSubmit(onSaveUser)}>
          <Typography variant="h5">{copy.userTitle}</Typography>

          <Controller
            name="timezone"
            control={userControl}
            render={({ field }: any) => (
              <AppRhfTextField field={field} label={copy.timezone} />
            )}
          />

          <Controller
            name="locale"
            control={userControl}
            render={({ field }: any) => (
              <AppRhfTextField field={field} label={copy.locale} />
            )}
          />

          <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSavingUser}>
            {copy.saveSettings}
          </AppButton>

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
      )}
    </Box>
  );
}
