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

type SettingsCardProps = {
  settings: AppSettings;
  onSettingsChange: (next: AppSettings) => void;
  onSave: () => void;
  onConnectGoogle: () => void;
  onLogout: () => void;
};

export function SettingsCard({
  settings,
  onSettingsChange,
  onSave,
  onConnectGoogle,
  onLogout
}: SettingsCardProps) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <AppTabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <AppTab label="Общие" />
        <AppTab label="Интеграции" />
      </AppTabs>

      {tab === 0 && (
        <AppForm>
          <Typography variant="h5">Настройки профиля</Typography>

          <AppTextField
            label="Timezone"
            value={settings.timezone}
            onChange={(event) => onSettingsChange({ ...settings, timezone: event.target.value })}
          />

          <AppTextField
            label="Locale"
            value={settings.locale}
            onChange={(event) => onSettingsChange({ ...settings, locale: event.target.value })}
          />

          <AppTextField
            label="Default meeting duration (min)"
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
            label="Daily digest enabled"
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
            label="Week starts on Monday"
          />

          <AppButton startIcon={<AppIcons.save />} onClick={onSave}>
            Сохранить настройки
          </AppButton>
        </AppForm>
      )}

      {tab === 1 && (
        <AppForm>
          <Typography variant="h5">Интеграции</Typography>
          <Typography color="text.secondary" variant="body2">
            Подключите внешние сервисы, чтобы автоматизировать бронирования и напоминания.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <AppButton variant="outlined" onClick={onConnectGoogle} disabled={settings.googleConnected}>
              {settings.googleConnected ? 'Google подключен' : 'Подключить Google'}
            </AppButton>

            <AppButton color="error" variant="text" startIcon={<AppIcons.logout />} onClick={onLogout}>
              Выйти
            </AppButton>
          </Stack>
        </AppForm>
      )}
    </Box>
  );
}
