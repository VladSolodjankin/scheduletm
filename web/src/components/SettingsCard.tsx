import { Box, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { AccountSettings, SystemSettings, UserSettings } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppRhfPasswordField } from '../shared/ui/AppRhfPasswordField';
import { AppRhfTextField } from '../shared/ui/AppRhfTextField';
import { AppTab, AppTabs } from '../shared/ui/AppTabs';

type SettingsCardCopy = {
  systemTab: string;
  accountTab: string;
  userTab: string;
  systemTitle: string;
  accountTitle: string;
  userTitle: string;
  timezone: string;
  locale: string;
  defaultMeetingDuration: string;
  dailyDigestEnabled: string;
  weekStartsOnMonday: string;
  refreshTokenTtlDays: string;
  accessTokenTtlSeconds: string;
  sessionCookieName: string;
  googleOauthClientId: string;
  googleOauthClientSecret: string;
  googleOauthRedirectUri: string;
  saveSettings: string;
  integrationsTitle: string;
  integrationsSubtitle: string;
  connectGoogle: string;
  connectingGoogle: string;
  disconnectGoogle: string;
  disconnectingGoogle: string;
  telegramBotToken: string;
  telegramBotConnected: string;
  telegramBotNotConnected: string;
  clearTelegramBotToken: string;
};

type SettingsCardProps = {
  systemSettings: SystemSettings;
  accountSettings: AccountSettings;
  userSettings: UserSettings;
  copy: SettingsCardCopy;
  canManageSystemSettings: boolean;
  canManageAccountSettings: boolean;
  isGoogleConnecting: boolean;
  isGoogleDisconnecting: boolean;
  isSavingSystem?: boolean;
  isSavingAccount?: boolean;
  isSavingUser?: boolean;
  onSaveSystem: (next: SystemSettings) => Promise<void> | void;
  onSaveAccount: (next: AccountSettings) => Promise<void> | void;
  onSaveUser: (next: UserSettings) => Promise<void> | void;
  onClearTelegramBotToken: () => Promise<void> | void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
};

export function SettingsCard({
  systemSettings,
  accountSettings,
  userSettings,
  copy,
  canManageSystemSettings,
  canManageAccountSettings,
  isGoogleConnecting,
  isGoogleDisconnecting,
  isSavingSystem = false,
  isSavingAccount = false,
  isSavingUser = false,
  onSaveSystem,
  onSaveAccount,
  onSaveUser,
  onClearTelegramBotToken,
  onConnectGoogle,
  onDisconnectGoogle
}: SettingsCardProps) {
  const [tab, setTab] = useState(canManageSystemSettings ? 0 : canManageAccountSettings ? 1 : 2);

  const { control: systemControl, handleSubmit: handleSystemSubmit, reset: resetSystem } = useForm<SystemSettings>({
    defaultValues: systemSettings
  });

  const { control: accountControl, handleSubmit: handleAccountSubmit, reset: resetAccount } = useForm<AccountSettings>({
    defaultValues: accountSettings
  });

  const { control: userControl, handleSubmit: handleUserSubmit, reset: resetUser } = useForm<UserSettings>({
    defaultValues: { ...userSettings, telegramBotToken: '' }
  });

  useEffect(() => {
    resetSystem(systemSettings);
  }, [resetSystem, systemSettings]);

  useEffect(() => {
    resetAccount(accountSettings);
  }, [accountSettings, resetAccount]);

  useEffect(() => {
    resetUser({ ...userSettings, telegramBotToken: '' });
  }, [resetUser, userSettings]);

  return (
    <Box>
      <AppTabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <AppTab label={copy.systemTab} disabled={!canManageSystemSettings} />
        <AppTab label={copy.accountTab} disabled={!canManageAccountSettings} />
        <AppTab label={copy.userTab} />
      </AppTabs>

      {tab === 0 && canManageSystemSettings && (
        <AppForm component="form" onSubmit={handleSystemSubmit(onSaveSystem)}>
          <Typography variant="h5">{copy.systemTitle}</Typography>

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
            name="refreshTokenTtlDays"
            control={systemControl}
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
            control={systemControl}
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
            control={systemControl}
            render={({ field }: any) => <AppRhfTextField field={field} label={copy.sessionCookieName} />}
          />

          <Controller
            name="googleOauthClientId"
            control={systemControl}
            render={({ field }: any) => <AppRhfTextField field={field} label={copy.googleOauthClientId} />}
          />

          <Controller
            name="googleOauthClientSecret"
            control={systemControl}
            render={({ field }: any) => <AppRhfPasswordField field={field} label={copy.googleOauthClientSecret} />}
          />

          <Controller
            name="googleOauthRedirectUri"
            control={systemControl}
            render={({ field }: any) => <AppRhfTextField field={field} label={copy.googleOauthRedirectUri} />}
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

      {tab === 1 && canManageAccountSettings && (
        <AppForm component="form" onSubmit={handleAccountSubmit(onSaveAccount)}>
          <Typography variant="h5">{copy.accountTitle}</Typography>

          <Controller name="timezone" control={accountControl} render={({ field }: any) => (
            <AppRhfTextField field={field} label={copy.timezone} />
          )} />

          <Controller name="locale" control={accountControl} render={({ field }: any) => (
            <AppRhfTextField field={field} label={copy.locale} />
          )} />

          <Controller
            name="defaultMeetingDuration"
            control={accountControl}
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
            control={accountControl}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.dailyDigestEnabled}
              />
            )}
          />

          <Controller
            name="weekStartsOnMonday"
            control={accountControl}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.weekStartsOnMonday}
              />
            )}
          />

          <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSavingAccount}>
            {copy.saveSettings}
          </AppButton>
        </AppForm>
      )}

      {tab === 2 && (
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

          <Controller
            name="telegramBotToken"
            control={userControl}
            render={({ field }: any) => (
              <AppRhfPasswordField field={field} label={copy.telegramBotToken} />
            )}
          />

          <Typography variant="body2" color="text.secondary">
            {userSettings.telegramBotConnected
              ? `${copy.telegramBotConnected}: ${userSettings.telegramBotName ?? '@unknown'}${userSettings.telegramBotUsername ? ` (@${userSettings.telegramBotUsername})` : ''}`
              : copy.telegramBotNotConnected}
          </Typography>

          <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSavingUser}>
            {copy.saveSettings}
          </AppButton>

          {userSettings.telegramBotConnected && (
            <AppButton
              type="button"
              variant="outlined"
              color="error"
              onClick={onClearTelegramBotToken}
              disabled={isSavingUser}
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
      )}
    </Box>
  );
}
