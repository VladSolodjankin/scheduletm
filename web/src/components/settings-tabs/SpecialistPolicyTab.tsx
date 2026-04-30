import { FormControlLabel, Switch, Typography } from '@mui/material';
import { Controller, Control } from 'react-hook-form';

import type { SpecialistBookingPolicy } from '../../shared/types/api';
import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';

type Props = {
  copy: SettingsCardCopy;
  control: Control<SpecialistBookingPolicy>;
  isSaving: boolean;
  onSubmit: () => void;
};

export function SpecialistPolicyTab({ copy, control, isSaving, onSubmit }: Props) {
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
        render={({ field }: any) => (
          <AppRhfTextField field={field} label={copy.meetingProvidersPriority} />
        )}
      />
      <Controller
        name="allowedMeetingProviders"
        control={control}
        render={({ field }: any) => (
          <AppRhfTextField field={field} label={copy.allowedMeetingProviders} />
        )}
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
