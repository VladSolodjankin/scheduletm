import { Box, Checkbox, FormControl, FormControlLabel, InputLabel, ListItemText, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type {
  AccountNotificationDefault,
  AccountSettings,
  NotificationChannel,
  SpecialistBookingPolicy,
  SystemSettings,
  UserSettings,
} from '../shared/types/api';
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
  specialistPolicyTab: string;
  notificationsTab: string;
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
  specialistPolicyTitle: string;
  cancelGracePeriodHours: string;
  refundOnLateCancel: string;
  autoCancelUnpaidEnabled: string;
  unpaidAutoCancelAfterHours: string;
  notificationSettingsTitle: string;
  reminderChannelsLabel: string;
  appointmentReminderTimingsLabel: string;
  paymentReminderTimingsLabel: string;
  disabledOption: string;
  channels: Record<NotificationChannel, string>;
};

type SettingsCardProps = {
  systemSettings: SystemSettings;
  accountSettings: AccountSettings;
  userSettings: UserSettings;
  specialistBookingPolicy: SpecialistBookingPolicy;
  accountNotificationDefaults: AccountNotificationDefault[];
  copy: SettingsCardCopy;
  canManageSystemSettings: boolean;
  canManageAccountSettings: boolean;
  canManageSpecialistBookingPolicy: boolean;
  isGoogleConnecting: boolean;
  isGoogleDisconnecting: boolean;
  isSavingSystem?: boolean;
  isSavingAccount?: boolean;
  isSavingUser?: boolean;
  isSavingSpecialistBookingPolicy?: boolean;
  isSavingNotificationDefaults?: boolean;
  onSaveSystem: (next: SystemSettings) => Promise<void> | void;
  onSaveAccount: (next: AccountSettings) => Promise<void> | void;
  onSaveUser: (next: UserSettings) => Promise<void> | void;
  onSaveSpecialistBookingPolicy: (next: SpecialistBookingPolicy) => Promise<void> | void;
  onSaveNotificationDefaults: (items: AccountNotificationDefault[]) => Promise<void> | void;
  onClearTelegramBotToken: () => Promise<void> | void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
};

export function SettingsCard({
  systemSettings,
  accountSettings,
  userSettings,
  specialistBookingPolicy,
  accountNotificationDefaults,
  copy,
  canManageSystemSettings,
  canManageAccountSettings,
  canManageSpecialistBookingPolicy,
  isGoogleConnecting,
  isGoogleDisconnecting,
  isSavingSystem = false,
  isSavingAccount = false,
  isSavingUser = false,
  isSavingSpecialistBookingPolicy = false,
  isSavingNotificationDefaults = false,
  onSaveSystem,
  onSaveAccount,
  onSaveUser,
  onSaveSpecialistBookingPolicy,
  onSaveNotificationDefaults,
  onClearTelegramBotToken,
  onConnectGoogle,
  onDisconnectGoogle
}: SettingsCardProps) {
  const timingOptions = [
    'disabled',
    ...[
      1,
      2,
      ...Array.from({ length: 12 }, (_, i) => 4 + i * 2) // 4 → 26
    ].map(h => `${h}h`)
  ];
  const selectableChannels: NotificationChannel[] = ['email', 'telegram', 'viber', 'sms', 'whatsapp'];
  const [tab, setTab] = useState(canManageSystemSettings ? 0 : canManageAccountSettings ? 1 : canManageSpecialistBookingPolicy ? 2 : 4);

  const { control: systemControl, handleSubmit: handleSystemSubmit, reset: resetSystem } = useForm<SystemSettings>({
    defaultValues: systemSettings
  });

  const { control: accountControl, handleSubmit: handleAccountSubmit, reset: resetAccount } = useForm<AccountSettings>({
    defaultValues: accountSettings
  });

  const { control: userControl, handleSubmit: handleUserSubmit, reset: resetUser } = useForm<UserSettings>({
    defaultValues: { ...userSettings, telegramBotToken: '' }
  });
  const { control: specialistPolicyControl, handleSubmit: handleSpecialistPolicySubmit, reset: resetSpecialistPolicy } = useForm<SpecialistBookingPolicy>({
    defaultValues: specialistBookingPolicy
  });
  const { control: notificationDefaultsControl, handleSubmit: handleNotificationDefaultsSubmit, reset: resetNotificationDefaults } = useForm<{
    channels: NotificationChannel[];
    appointmentReminderTimings: string[];
    paymentReminderTimings: string[];
  }>({
    defaultValues: {
      channels: ['email'],
      appointmentReminderTimings: ['disabled'],
      paymentReminderTimings: ['disabled'],
    }
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
  useEffect(() => {
    resetSpecialistPolicy(specialistBookingPolicy);
  }, [resetSpecialistPolicy, specialistBookingPolicy]);
  useEffect(() => {
    const defaultsByType = new Map(accountNotificationDefaults.map((item) => [item.notificationType, item]));
    const reminder = defaultsByType.get('appointment_reminder');
    const payment = defaultsByType.get('payment_reminder');
    const channels = accountNotificationDefaults
      .filter((item) => item.enabled)
      .map((item) => item.preferredChannel)
      .filter((item, index, list) => list.indexOf(item) === index);

    resetNotificationDefaults({
      channels: channels.length > 0 ? channels : ['email'],
      appointmentReminderTimings: reminder?.enabled ? reminder.sendTimings : ['disabled'],
      paymentReminderTimings: payment?.enabled ? payment.sendTimings : ['disabled'],
    });
  }, [accountNotificationDefaults, resetNotificationDefaults]);

  const onChange= (field, event) => {
    const value = event.target.value as string[];

    if (field.value.includes('disabled') && value.length > 1) {
      field.onChange(value.filter(v => v !== 'disabled'));
      return;
    }

    if (value.includes('disabled')) {
      field.onChange(['disabled']);
      return;
    }

    field.onChange(value);
  }

  return (
    <Box>
      <AppTabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <AppTab label={copy.systemTab} disabled={!canManageSystemSettings} />
        <AppTab label={copy.accountTab} disabled={!canManageAccountSettings} />
        <AppTab label={copy.specialistPolicyTab} disabled={!canManageSpecialistBookingPolicy} />
        <AppTab label={copy.notificationsTab} disabled={!canManageAccountSettings} />
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

      {tab === 2 && canManageSpecialistBookingPolicy && (
        <AppForm component="form" onSubmit={handleSpecialistPolicySubmit(onSaveSpecialistBookingPolicy)}>
          <Typography variant="h5">{copy.specialistPolicyTitle}</Typography>

          <Controller
            name="cancelGracePeriodHours"
            control={specialistPolicyControl}
            render={({ field }: any) => (
              <AppRhfTextField
                field={field}
                label={copy.cancelGracePeriodHours}
                type="number"
                slotProps={{ htmlInput: { min: 0, max: 336 } }}
                parseValue={(value) => Number(value)}
              />
            )}
          />

          <Controller
            name="refundOnLateCancel"
            control={specialistPolicyControl}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.refundOnLateCancel}
              />
            )}
          />

          <Controller
            name="autoCancelUnpaidEnabled"
            control={specialistPolicyControl}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.autoCancelUnpaidEnabled}
              />
            )}
          />

          <Controller
            name="unpaidAutoCancelAfterHours"
            control={specialistPolicyControl}
            render={({ field }: any) => (
              <AppRhfTextField
                field={field}
                label={copy.unpaidAutoCancelAfterHours}
                type="number"
                slotProps={{ htmlInput: { min: 1, max: 720 } }}
                parseValue={(value) => Number(value)}
              />
            )}
          />

          <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSavingSpecialistBookingPolicy}>
            {copy.saveSettings}
          </AppButton>
        </AppForm>
      )}

      {tab === 3 && canManageAccountSettings && (
        <AppForm
          component="form"
          onSubmit={handleNotificationDefaultsSubmit((values) => {
            const enabledChannels = values.channels;
            const appointmentEnabled = !values.appointmentReminderTimings.includes('disabled');
            const paymentEnabled = !values.paymentReminderTimings.includes('disabled');
            const appointmentTimings = values.appointmentReminderTimings.filter((item) => item !== 'disabled');
            const paymentTimings = values.paymentReminderTimings.filter((item) => item !== 'disabled');

            const next: AccountNotificationDefault[] = enabledChannels.flatMap((channel) => ([
              {
                notificationType: 'appointment_created',
                preferredChannel: channel,
                enabled: true,
                sendTimings: ['immediate'],
                frequency: 'immediate',
              },
              {
                notificationType: 'appointment_reminder',
                preferredChannel: channel,
                enabled: appointmentEnabled,
                sendTimings: appointmentEnabled ? appointmentTimings : [],
                frequency: 'immediate',
              },
              {
                notificationType: 'payment_reminder',
                preferredChannel: channel,
                enabled: paymentEnabled,
                sendTimings: paymentEnabled ? paymentTimings : [],
                frequency: 'daily',
              },
            ]));

            return onSaveNotificationDefaults(next);
          })}
        >
          <Typography variant="h5">{copy.notificationSettingsTitle}</Typography>

          <Controller
            name="channels"
            control={notificationDefaultsControl}
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
            control={notificationDefaultsControl}
            render={({ field }: any) => (
              <FormControl>
                <InputLabel id="appointment-reminder-timings-label">{copy.appointmentReminderTimingsLabel}</InputLabel>
                <Select
                  {...field}
                  labelId="appointment-reminder-timings-label"
                  label={copy.appointmentReminderTimingsLabel}
                  multiple
                  value={field.value}
                  onChange={(event) => onChange(field, event)}
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
            control={notificationDefaultsControl}
            render={({ field }: any) => (
              <FormControl>
                <InputLabel id="payment-reminder-timings-label">{copy.paymentReminderTimingsLabel}</InputLabel>
                <Select
                  {...field}
                  labelId="payment-reminder-timings-label"
                  label={copy.paymentReminderTimingsLabel}
                  multiple
                  value={field.value}
                  onChange={(event) => onChange(field, event)}
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

          <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSavingNotificationDefaults}>
            {copy.saveSettings}
          </AppButton>
        </AppForm>
      )}

      {tab === 4 && (
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
