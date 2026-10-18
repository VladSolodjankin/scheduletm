import { FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Select, Switch, Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

import type { SpecialistBookingPolicy, UserSettings } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';

type Props = {
  copy: SettingsCardCopy;
  userSettings: UserSettings;
  control: Control<SpecialistBookingPolicy>;
  isSaving: boolean;
  onSubmit: () => void;
};

const providerIds = ['offline', 'zoom', 'yandex_telemost', 'manual'] as const;

// Each preset puts one provider first and keeps the others in default order.
const providerPriorityPresets = providerIds.map((first) => (
  [first, ...providerIds.filter((id) => id !== first)].join(',')
));

export function SpecialistPolicyTab({ copy, userSettings, control, isSaving, onSubmit }: Props) {
  const providerLabelById: Record<string, string> = copy.providerLabels;
  const isProviderConnected = (id: string) => (
    id === 'zoom' ? userSettings.zoomConnected : id === 'yandex_telemost' ? userSettings.yandexConnected : true
  );
  const providerLabelWithHint = (id: string) => (
    isProviderConnected(id)
      ? (providerLabelById[id] ?? id)
      : `${providerLabelById[id] ?? id} (${copy.meetingProviderNotConnected})`
  );
  const priorityLabel = (value: string) => value.split(',').filter(Boolean).map((id) => providerLabelById[id] ?? id).join(' → ');

  return (
    <AppForm component="form" onSubmit={onSubmit}>
      <Typography variant="h5">{copy.specialistPolicyTitle}</Typography>

      <Controller
        name="cancelGracePeriodHours"
        control={control}
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
        control={control}
        render={({ field }: any) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            label={copy.refundOnLateCancel}
          />
        )}
      />

      <Controller
        name="autoCancelUnpaidEnabled"
        control={control}
        render={({ field }: any) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            label={copy.autoCancelUnpaidEnabled}
          />
        )}
      />

      <Controller
        name="unpaidAutoCancelAfterHours"
        control={control}
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

      <Controller
        name="meetingProvidersPriority"
        control={control}
        render={({ field }: any) => {
          // Keep previously saved orders selectable even if they are not one of the presets.
          const priorityOptions = providerPriorityPresets.includes(field.value) || !field.value
            ? providerPriorityPresets
            : [field.value as string, ...providerPriorityPresets];

          return (
            <FormControl fullWidth>
              <InputLabel>{copy.meetingProvidersPriority}</InputLabel>
              <Select {...field} label={copy.meetingProvidersPriority}>
                {priorityOptions.map((value) => (
                  <MenuItem key={value} value={value}>{priorityLabel(value)}</MenuItem>
                ))}
              </Select>
              <FormHelperText>{copy.meetingProvidersHint}</FormHelperText>
            </FormControl>
          );
        }}
      />

      <Controller
        name="allowedMeetingProviders"
        control={control}
        render={({ field }: any) => {
          const selectedProviders = (field.value || '').split(',').filter(Boolean);

          return (
            <FormControl fullWidth>
              <InputLabel>{copy.allowedMeetingProviders}</InputLabel>
              <Select
                multiple
                value={selectedProviders}
                label={copy.allowedMeetingProviders}
                onChange={(event) => {
                  const next = [...(event.target.value as string[])].join(',');
                  field.onChange(next);
                }}
                renderValue={(selected) => (selected as string[])
                  .map((id) => providerLabelById[id] ?? id)
                  .join(', ')}
              >
                {providerIds.map((providerId) => (
                  <MenuItem key={providerId} value={providerId}>{providerLabelWithHint(providerId)}</MenuItem>
                ))}
              </Select>
              {selectedProviders.some((id: string) => !isProviderConnected(id)) && (
                <FormHelperText>
                  {selectedProviders
                    .filter((id: string) => !isProviderConnected(id))
                    .map((id: string) => `${providerLabelById[id] ?? id} (${copy.meetingProviderNotConnected})`)
                    .join(', ')}
                </FormHelperText>
              )}
            </FormControl>
          );
        }}
      />
      <Controller
        name="meetingProviderOverrideEnabled"
        control={control}
        render={({ field }: any) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
            label={copy.meetingProviderOverrideEnabled}
          />
        )}
      />

      <AppButton type="submit" startIcon={<AppIcons.save />} isLoading={isSaving}>
        {copy.saveSettings}
      </AppButton>
    </AppForm>
  );
}
