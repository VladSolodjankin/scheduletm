import { Stack, Typography } from '@mui/material';

import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppRhfPasswordField } from '../../shared/ui/AppRhfPasswordField';
import { AppTextField } from '../../shared/ui/AppTextField';

type Props = {
  copy: SettingsCardCopy;
  newEmail: string;
  password: string;
  otpCode: string;
  step: 'email' | 'otp';
  onNewEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onCancel: () => void;
  onRequestOtp: () => Promise<void> | void;
  onConfirmOtp: () => Promise<void> | void;
};

export function EmailChangeSettingsTab({
  copy,
  newEmail,
  password,
  otpCode,
  step,
  onNewEmailChange,
  onPasswordChange,
  onOtpCodeChange,
  onCancel,
  onRequestOtp,
  onConfirmOtp,
}: Props) {
  const passwordFieldBase = {
    onBlur: () => undefined,
    ref: () => undefined,
  };

  return (
    <AppForm component="form" onSubmit={(event) => event.preventDefault()}>
      <Typography variant="h5">{copy.emailChangeTitle}</Typography>
      <Stack spacing={2}>
        <AppTextField
          value={newEmail}
          onChange={(event) => onNewEmailChange(event.target.value)}
          label={copy.newEmail}
          type="email"
          disabled={step === 'otp'}
        />
        <AppRhfPasswordField
          field={{ ...passwordFieldBase, name: 'emailChangePassword', value: password, onChange: onPasswordChange }}
          label={copy.currentPasswordForEmail}
          autoComplete="current-password"
          disabled={step === 'otp'}
        />
        {step === 'otp' && (
          <AppTextField
            value={otpCode}
            onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
            label={copy.emailOtpCode}
          />
        )}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {step === 'otp' && (
          <AppButton type="button" variant="outlined" onClick={onCancel}>
            {copy.cancel}
          </AppButton>
        )}
        {step === 'email' ? (
          <AppButton type="button" onClick={() => void onRequestOtp()}>
            {copy.sendEmailOtp}
          </AppButton>
        ) : (
          <AppButton type="button" onClick={() => void onConfirmOtp()}>
            {copy.confirmEmailOtp}
          </AppButton>
        )}
      </Stack>
    </AppForm>
  );
}
