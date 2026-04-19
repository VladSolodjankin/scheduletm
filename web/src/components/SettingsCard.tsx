import {
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import type { AppSettings } from '../shared/types/api';

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
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 6 }}>
      <Stack spacing={2} sx={{ p: 3, borderRadius: 2, boxShadow: 2, bgcolor: 'background.paper' }}>
        <Typography variant="h5">Настройки</Typography>

        <TextField
          label="Timezone"
          value={settings.timezone}
          onChange={(event) => onSettingsChange({ ...settings, timezone: event.target.value })}
        />

        <TextField
          label="Locale"
          value={settings.locale}
          onChange={(event) => onSettingsChange({ ...settings, locale: event.target.value })}
        />

        <TextField
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

        <Button variant="contained" onClick={onSave}>
          Сохранить настройки
        </Button>

        <Button variant="outlined" onClick={onConnectGoogle} disabled={settings.googleConnected}>
          {settings.googleConnected ? 'Google подключен' : 'Подключить Google'}
        </Button>

        <Button color="error" variant="text" onClick={onLogout}>
          Выйти
        </Button>
      </Stack>
    </Box>
  );
}
