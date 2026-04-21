import { Box, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { AppSettings } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppForm } from '../shared/ui/AppForm';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppTab, AppTabs } from '../shared/ui/AppTabs';
import { AppTextField } from '../shared/ui/AppTextField';

type SettingsCardCopy = {
  generalTab: string;
  integrationsTab: string;
  profileTitle: string;
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
  googleConnected: string;
};

type SettingsCardProps = {
  settings: AppSettings;
  copy: SettingsCardCopy;
  isGoogleConnecting: boolean;
  isSaving?: boolean;
  onSave: (next: AppSettings) => Promise<void> | void;
  onConnectGoogle: () => void;
};

export function SettingsCard({
  settings,
  copy,
  isGoogleConnecting,
  isSaving = false,
  onSave,
  onConnectGoogle
}: SettingsCardProps) {
  const [tab, setTab] = useState(0);

  const { control, handleSubmit, reset } = useForm<AppSettings>({
    defaultValues: settings
  });

  useEffect(() => {
    reset(settings);
  }, [reset, settings]);

  return (
    <Box>
      <AppTabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <AppTab label={copy.generalTab} />
        <AppTab label={copy.integrationsTab} />
      </AppTabs>

      {tab === 0 && (
        <AppForm component="form" onSubmit={handleSubmit(onSave)}>
          <Typography variant="h5">{copy.profileTitle}</Typography>

          <Controller
            name="timezone"
            control={control}
            render={({ field }: any) => <AppTextField {...field} label={copy.timezone} />}
          />

          <Controller
            name="locale"
            control={control}
            render={({ field }: any) => <AppTextField {...field} label={copy.locale} />}
          />

          <Controller
            name="defaultMeetingDuration"
            control={control}
            render={({ field }: any) => (
              <AppTextField
                {...field}
                label={copy.defaultMeetingDuration}
                type="number"
                inputProps={{ min: 15, max: 180 }}
                onChange={(event) => field.onChange(Number(event.target.value))}
              />
            )}
          />

          <Controller
            name="dailyDigestEnabled"
            control={control}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.dailyDigestEnabled}
              />
            )}
          />

          <Controller
            name="weekStartsOnMonday"
            control={control}
            render={({ field }: any) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={copy.weekStartsOnMonday}
              />
            )}
          />

          <AppButton type="submit" startIcon={<AppIcons.save />} disabled={isSaving}>
            {copy.saveSettings}
          </AppButton>
        </AppForm>
      )}

      {tab === 1 && (
        <AppForm>
          <Typography variant="h5">{copy.integrationsTitle}</Typography>
          <Typography color="text.secondary" variant="body2">
            {copy.integrationsSubtitle}
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <AppButton
              variant="outlined"
              onClick={onConnectGoogle}
              disabled={settings.googleConnected || isGoogleConnecting}
            >
              {settings.googleConnected
                ? copy.googleConnected
                : isGoogleConnecting
                  ? copy.connectingGoogle
                  : copy.connectGoogle}
            </AppButton>
          </Stack>
        </AppForm>
      )}
    </Box>
  );
}
