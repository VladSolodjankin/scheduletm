import { Box } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import type {
  AccountNotificationDefault,
  AccountSettings,
  NotificationChannel,
  SpecialistBookingPolicy,
  SystemSettings,
  UserSettings,
} from '../shared/types/api';
import type { SettingsCardCopy } from './SettingsCard.types';
import { AppTab, AppTabs } from '../shared/ui/AppTabs';
import { AccountSettingsTab } from './settings-tabs/AccountSettingsTab';
import { NotificationSettingsTab } from './settings-tabs/NotificationSettingsTab';
import { SpecialistPolicyTab } from './settings-tabs/SpecialistPolicyTab';
import { SystemSettingsTab } from './settings-tabs/SystemSettingsTab';
import { UserSettingsTab } from './settings-tabs/UserSettingsTab';

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
  const tabs = useMemo(() => ([
    ...(canManageSystemSettings ? [{ key: 'system', label: copy.systemTab }] : []),
    ...(canManageAccountSettings ? [{ key: 'account', label: copy.accountTab }] : []),
    ...(canManageSpecialistBookingPolicy ? [{ key: 'specialistPolicy', label: copy.specialistPolicyTab }] : []),
    ...(canManageAccountSettings ? [{ key: 'notifications', label: copy.notificationsTab }] : []),
    { key: 'user', label: copy.userTab }
  ] as const), [copy, canManageSystemSettings, canManageAccountSettings, canManageSpecialistBookingPolicy]);

  const initialTab = tabs[0]?.key ?? 'user';
  const timingOptions = ['disabled', ...[1, 2, ...Array.from({ length: 12 }, (_, i) => 4 + i * 2)].map(h => `${h}h`)];
  const selectableChannels: NotificationChannel[] = ['email', 'telegram', 'viber', 'sms', 'whatsapp'];
  const meetingDurationOptions = Array.from({ length: 7 }, (_, i) => 30 + i * 10);
  const [tab, setTab] = useState<string>(initialTab);

  const { control: systemControl, handleSubmit: handleSystemSubmit, reset: resetSystem } = useForm<SystemSettings>({ defaultValues: systemSettings });
  const { control: accountControl, handleSubmit: handleAccountSubmit, reset: resetAccount } = useForm<AccountSettings>({ defaultValues: accountSettings });
  const { control: userControl, handleSubmit: handleUserSubmit, reset: resetUser } = useForm<UserSettings>({ defaultValues: { ...userSettings, telegramBotToken: '' } });
  const { control: specialistPolicyControl, handleSubmit: handleSpecialistPolicySubmit, reset: resetSpecialistPolicy } = useForm<SpecialistBookingPolicy>({ defaultValues: specialistBookingPolicy });
  const { control: notificationDefaultsControl, handleSubmit: handleNotificationDefaultsSubmit, reset: resetNotificationDefaults } = useForm<{
    channels: NotificationChannel[];
    appointmentReminderTimings: string[];
    paymentReminderTimings: string[];
  }>({
    defaultValues: { channels: ['email'], appointmentReminderTimings: ['disabled'], paymentReminderTimings: ['disabled'] }
  });

  useEffect(() => { resetSystem(systemSettings); }, [resetSystem, systemSettings]);
  useEffect(() => { resetAccount(accountSettings); }, [accountSettings, resetAccount]);
  useEffect(() => { resetUser({ ...userSettings, telegramBotToken: '' }); }, [resetUser, userSettings]);
  useEffect(() => { resetSpecialistPolicy(specialistBookingPolicy); }, [resetSpecialistPolicy, specialistBookingPolicy]);
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

  return (
    <Box>
      <AppTabs value={tabs.findIndex((item) => item.key === tab)} onChange={(_, next) => setTab(tabs[next]?.key ?? initialTab)} sx={{ mb: 2 }}>
        {tabs.map((item) => <AppTab key={item.key} label={item.label} />)}
      </AppTabs>

      {tab === 'system' && <SystemSettingsTab copy={copy} control={systemControl} meetingDurationOptions={meetingDurationOptions} isSaving={isSavingSystem} onSubmit={handleSystemSubmit(onSaveSystem)} />}
      {tab === 'account' && <AccountSettingsTab copy={copy} control={accountControl} meetingDurationOptions={meetingDurationOptions} isSaving={isSavingAccount} onSubmit={handleAccountSubmit(onSaveAccount)} />}
      {tab === 'specialistPolicy' && <SpecialistPolicyTab copy={copy} control={specialistPolicyControl} isSaving={isSavingSpecialistBookingPolicy} onSubmit={handleSpecialistPolicySubmit(onSaveSpecialistBookingPolicy)} />}
      {tab === 'user' && (
        <UserSettingsTab
          copy={copy}
          control={userControl}
          userSettings={userSettings}
          isSaving={isSavingUser}
          isGoogleConnecting={isGoogleConnecting}
          isGoogleDisconnecting={isGoogleDisconnecting}
          onSubmit={handleUserSubmit(onSaveUser)}
          onClearTelegramBotToken={onClearTelegramBotToken}
          onConnectGoogle={onConnectGoogle}
          onDisconnectGoogle={onDisconnectGoogle}
        />
      )}
      {tab === 'notifications' && (
        <NotificationSettingsTab
          copy={copy}
          control={notificationDefaultsControl}
          timingOptions={timingOptions}
          selectableChannels={selectableChannels}
          isSaving={isSavingNotificationDefaults}
          onSubmit={handleNotificationDefaultsSubmit((values) => {
            const enabledChannels = values.channels;
            const appointmentEnabled = !values.appointmentReminderTimings.includes('disabled');
            const paymentEnabled = !values.paymentReminderTimings.includes('disabled');
            const appointmentTimings = values.appointmentReminderTimings.filter((item) => item !== 'disabled');
            const paymentTimings = values.paymentReminderTimings.filter((item) => item !== 'disabled');

            const next: AccountNotificationDefault[] = enabledChannels.flatMap((channel) => ([
              { notificationType: 'appointment_created', preferredChannel: channel, enabled: true, sendTimings: ['immediate'], frequency: 'immediate' },
              { notificationType: 'appointment_reminder', preferredChannel: channel, enabled: appointmentEnabled, sendTimings: appointmentEnabled ? appointmentTimings : [], frequency: 'immediate' },
              { notificationType: 'payment_reminder', preferredChannel: channel, enabled: paymentEnabled, sendTimings: paymentEnabled ? paymentTimings : [], frequency: 'daily' },
            ]));

            return onSaveNotificationDefaults(next);
          })}
        />
      )}
    </Box>
  );
}
