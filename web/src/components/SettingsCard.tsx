import { Box } from '@mui/material';
import { useEffect, useMemo } from 'react';
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
import { PasswordSettingsTab } from './settings-tabs/PasswordSettingsTab';
import { SpecialistPolicyTab } from './settings-tabs/SpecialistPolicyTab';
import { SystemSettingsTab } from './settings-tabs/SystemSettingsTab';
import { IntegrationsSettingsTab } from './settings-tabs/IntegrationsSettingsTab';
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
  isZoomConnecting: boolean;
  isSavingSystem?: boolean;
  isSavingAccount?: boolean;
  isSavingUser?: boolean;
  isSavingSpecialistBookingPolicy?: boolean;
  isSavingNotificationDefaults?: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otpCode: string;
  passwordStep: 'password' | 'otp';
  onSaveSystem: (next: SystemSettings) => Promise<void> | void;
  onSaveAccount: (next: AccountSettings) => Promise<void> | void;
  onSaveUser: (next: UserSettings) => Promise<void> | void;
  onSaveSpecialistBookingPolicy: (next: SpecialistBookingPolicy) => Promise<void> | void;
  onSaveNotificationDefaults: (items: AccountNotificationDefault[]) => Promise<void> | void;
  onClearTelegramBotToken: () => Promise<void> | void;
  onConnectGoogle: () => void;
  onConnectZoom: () => void;
  onDisconnectGoogle: () => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onCancelPasswordChange: () => void;
  onRequestPasswordOtp: () => Promise<void> | void;
  onConfirmPasswordOtp: () => Promise<void> | void;
  activeTab: string;
  onTabChange: (tab: string) => void;
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
  isZoomConnecting,
  isSavingSystem = false,
  isSavingAccount = false,
  isSavingUser = false,
  isSavingSpecialistBookingPolicy = false,
  isSavingNotificationDefaults = false,
  currentPassword,
  newPassword,
  confirmPassword,
  otpCode,
  passwordStep,
  onSaveSystem,
  onSaveAccount,
  onSaveUser,
  onSaveSpecialistBookingPolicy,
  onSaveNotificationDefaults,
  onClearTelegramBotToken,
  onConnectGoogle,
  onConnectZoom,
  onDisconnectGoogle
  ,onCurrentPasswordChange
  ,onNewPasswordChange
  ,onConfirmPasswordChange
  ,onOtpCodeChange
  ,onCancelPasswordChange
  ,onRequestPasswordOtp
  ,onConfirmPasswordOtp
  ,activeTab
  ,onTabChange
}: SettingsCardProps) {
  const tabs = useMemo(() => ([
    ...(canManageSystemSettings ? [{ key: 'system', label: copy.systemTab }] : []),
    ...(canManageAccountSettings ? [{ key: 'account', label: copy.accountTab }] : []),
    ...(canManageSpecialistBookingPolicy ? [{ key: 'specialistPolicy', label: copy.specialistPolicyTab }] : []),
    ...(canManageAccountSettings ? [{ key: 'notifications', label: copy.notificationsTab }] : []),
    { key: 'user', label: copy.userTab },
    { key: 'integrations', label: copy.integrationsTab },
    { key: 'password', label: copy.passwordTab }
  ] as const), [copy, canManageSystemSettings, canManageAccountSettings, canManageSpecialistBookingPolicy]);

  const initialTab = tabs[0]?.key ?? 'user';
  const timingOptions = ['disabled', ...[1, 2, ...Array.from({ length: 12 }, (_, i) => 4 + i * 2)].map(h => `${h}h`)];
  const selectableChannels: NotificationChannel[] = ['email', 'telegram', 'viber', 'sms', 'whatsapp'];
  const meetingDurationOptions = Array.from({ length: 7 }, (_, i) => 30 + i * 10);

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

  const resolvedTab = tabs.some((item) => item.key === activeTab) ? activeTab : initialTab;

  return (
    <Box>
      <AppTabs value={tabs.findIndex((item) => item.key === resolvedTab)} onChange={(_, next) => onTabChange(tabs[next]?.key ?? initialTab)} sx={{ mb: 2 }}>
        {tabs.map((item) => <AppTab key={item.key} label={item.label} />)}
      </AppTabs>

      {resolvedTab === 'system' && <SystemSettingsTab copy={copy} control={systemControl} meetingDurationOptions={meetingDurationOptions} isSaving={isSavingSystem} onSubmit={handleSystemSubmit(onSaveSystem)} />}
      {resolvedTab === 'account' && <AccountSettingsTab copy={copy} control={accountControl} meetingDurationOptions={meetingDurationOptions} isSaving={isSavingAccount} onSubmit={handleAccountSubmit(onSaveAccount)} />}
      {resolvedTab === 'specialistPolicy' && <SpecialistPolicyTab copy={copy} control={specialistPolicyControl} isSaving={isSavingSpecialistBookingPolicy} onSubmit={handleSpecialistPolicySubmit(onSaveSpecialistBookingPolicy)} />}
      {resolvedTab === 'user' && (
        <UserSettingsTab
          copy={copy}
          control={userControl}
          isSaving={isSavingUser}
          onSubmit={handleUserSubmit(onSaveUser)}
        />
      )}
      {resolvedTab === 'integrations' && (
        <IntegrationsSettingsTab
          copy={copy}
          control={userControl}
          userSettings={userSettings}
          isSaving={isSavingUser}
          isGoogleConnecting={isGoogleConnecting}
          isGoogleDisconnecting={isGoogleDisconnecting}
          isZoomConnecting={isZoomConnecting}
          onSubmit={handleUserSubmit(onSaveUser)}
          onClearTelegramBotToken={onClearTelegramBotToken}
          onConnectGoogle={onConnectGoogle}
          onConnectZoom={onConnectZoom}
          onDisconnectGoogle={onDisconnectGoogle}
        />
      )}
      {resolvedTab === 'password' && (
        <PasswordSettingsTab
          copy={copy}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          otpCode={otpCode}
          passwordStep={passwordStep}
          onCurrentPasswordChange={onCurrentPasswordChange}
          onNewPasswordChange={onNewPasswordChange}
          onConfirmPasswordChange={onConfirmPasswordChange}
          onOtpCodeChange={onOtpCodeChange}
          onCancel={onCancelPasswordChange}
          onRequestOtp={onRequestPasswordOtp}
          onConfirmOtp={onConfirmPasswordOtp}
        />
      )}
      {resolvedTab === 'notifications' && (
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
