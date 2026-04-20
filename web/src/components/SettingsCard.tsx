import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography
} from '@mui/material';
import { useState } from 'react';
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
  logout: string;
};

type SettingsCardProps = {
  settings: AppSettings;
  copy: SettingsCardCopy;
  isGoogleConnecting: boolean;
  onSettingsChange: (next: AppSettings) => void;
  onSave: () => void;
  onConnectGoogle: () => void;
  onLogout: () => void;
};

export function SettingsCard({
  settings,
  copy,
  isGoogleConnecting,
  onSettingsChange,
  onSave,
  onConnectGoogle,
  onLogout
}: SettingsCardProps) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <AppTabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <AppTab label={copy.generalTab} />
        <AppTab label={copy.integrationsTab} />
      </AppTabs>

      {tab === 0 && (
        <AppForm>
          <Typography variant="h5">{copy.profileTitle}</Typography>

          <AppTextField
            label={copy.timezone}
            value={settings.timezone}
            onChange={(event) => onSettingsChange({ ...settings, timezone: event.target.value })}
          />

          <AppTextField
            label={copy.locale}
            value={settings.locale}
            onChange={(event) => onSettingsChange({ ...settings, locale: event.target.value })}
          />

          <AppTextField
            label={copy.defaultMeetingDuration}
            type="number"
            inputProps={{ min: 15, max: 180 }}
            value={settings.defaultMeetingDuration}
            onChange={(event) =>
              onSettingsChange({ ...settings, defaultMeetingDuration: Number(event.target.value) })
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.dailyDigestEnabled}
                onChange={(event) =>
                  onSettingsChange({ ...settings, dailyDigestEnabled: event.target.checked })
                }
              />
            }
            label={copy.dailyDigestEnabled}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.weekStartsOnMonday}
                onChange={(event) =>
                  onSettingsChange({ ...settings, weekStartsOnMonday: event.target.checked })
                }
              />
            }
            label={copy.weekStartsOnMonday}
          />

          <AppButton startIcon={<AppIcons.save />} onClick={onSave}>
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

            <AppButton color="error" variant="text" startIcon={<AppIcons.logout />} onClick={onLogout}>
              {copy.logout}
            </AppButton>
          </Stack>
        </AppForm>
      )}
    </Box>
  );
}
